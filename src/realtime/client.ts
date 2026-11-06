/**
 * Cliente do WebSocket `/ws/realtime` (backend: apps/realtime/consumers.py). Parte de `src/lib/realtime.ts` do painel,
 * mais simples porque o app assina uma empresa por vez.
 *
 * O token vai no subprotocolo, nunca na URL: URL aparece em logs de proxy. Evento com `truncated: true` traz só ids;
 * quem escuta busca o registro na API. Ao reconectar, avisa por `onResync`, porque o que chegou no intervalo se perdeu.
 */
export interface RealtimeChange<T = Record<string, unknown>> {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: Partial<T> | null;
  company_id?: string | null;
  id?: string;
  truncated?: boolean;
}

export type RealtimeState = "idle" | "connecting" | "online" | "reconnecting" | "unauthorized";

type Listener = (change: RealtimeChange) => void;

export const REALTIME_TABLES = [
  "conversations",
  "conversation_status_history",
  "conversation_assignments",
  "messages",
  "notifications",
  "lead_alerts",
] as const;

const HEARTBEAT_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;
/** Com a tela fechada, a conexão não serve para nada e gasta bateria. Quem avisa é a notificação. */
const HIDDEN_CLOSE_MS = 30_000;
const CLOSE_UNAUTHORIZED = 4401;

export interface RealtimeOptions {
  url: () => string;
  token: () => string | null;
  tables?: readonly string[];
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private companyId: string | null = null;
  private state: RealtimeState = "idle";
  private retries = 0;
  private everOnline = false;
  private pendingResync = false;
  private lastFrameAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly stateListeners = new Set<(state: RealtimeState) => void>();
  private readonly resyncListeners = new Set<() => void>();
  private readonly revokedListeners = new Set<(companyId: string) => void>();

  constructor(private readonly options: RealtimeOptions) {
    window.addEventListener("online", this.wake);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Assina uma empresa. Trocar de empresa refaz a conexão, para não misturar eventos. */
  connect(companyId: string): void {
    if (this.companyId === companyId && this.ws) return;
    this.close();
    this.companyId = companyId;
    this.everOnline = false;
    this.open();
  }

  disconnect(): void {
    this.close();
    this.companyId = null;
    this.everOnline = false;
    this.setState("idle");
  }

  /** Solta os ouvintes globais. O app usa uma instância só, que vive até fechar; serve aos testes. */
  destroy(): void {
    this.disconnect();
    window.removeEventListener("online", this.wake);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  getState(): RealtimeState {
    return this.state;
  }

  on(table: string, listener: Listener): () => void {
    const set = this.listeners.get(table) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(table, set);
    return () => set.delete(listener);
  }

  onState(listener: (state: RealtimeState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onResync(listener: () => void): () => void {
    this.resyncListeners.add(listener);
    return () => this.resyncListeners.delete(listener);
  }

  onRevoked(listener: (companyId: string) => void): () => void {
    this.revokedListeners.add(listener);
    return () => this.revokedListeners.delete(listener);
  }

  private setState(state: RealtimeState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private open(): void {
    if (!this.companyId) return;
    const token = this.options.token();
    if (!token) {
      this.setState("idle");
      return;
    }
    this.setState(this.everOnline ? "reconnecting" : "connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.options.url(), ["geon-realtime", `bearer.${token}`]);
    } catch (error) {
      console.warn("[realtime] não foi possível abrir a conexão", error);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retries = 0;
      this.lastFrameAt = Date.now();
      this.pendingResync = this.everOnline;
      this.send({
        type: "subscribe",
        company_id: this.companyId,
        tables: this.options.tables ?? REALTIME_TABLES,
      });
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastFrameAt > HEARTBEAT_TIMEOUT_MS) {
          ws.close(4000, "heartbeat");
          return;
        }
        this.send({ type: "ping" });
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.lastFrameAt = Date.now();
      this.handle(event.data);
    };
    ws.onerror = () => {
      // O `close` vem em seguida e cuida da reconexão.
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopPing();
      if (event.code === CLOSE_UNAUTHORIZED) {
        this.setState("unauthorized");
        return;
      }
      this.setState(this.everOnline ? "reconnecting" : "connecting");
      this.scheduleReconnect();
    };
  }

  private handle(raw: unknown): void {
    let message: {
      type?: string;
      company_id?: unknown;
      detail?: unknown;
    } & Partial<RealtimeChange>;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    switch (message.type) {
      case "subscribed":
        this.everOnline = true;
        this.setState("online");
        if (this.pendingResync) {
          // Só depois de assinar: um evento entre o recarregamento e a assinatura não se perde.
          this.pendingResync = false;
          for (const listener of this.resyncListeners) listener();
        }
        return;
      case "change":
        if (message.table) {
          for (const listener of this.listeners.get(message.table) ?? []) {
            listener(message as RealtimeChange);
          }
        }
        return;
      case "revoked":
        for (const listener of this.revokedListeners) listener(String(message.company_id));
        return;
      case "error":
        console.warn("[realtime]", message.detail);
        return;
      default:
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.companyId) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(this.retries, 5));
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    this.stopPing();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  /** Voltou a rede ou a tela: tenta já, sem esperar o intervalo de nova tentativa. */
  private readonly wake = (): void => {
    if (!this.companyId || this.ws || this.state === "unauthorized") return;
    if (document.visibilityState === "hidden") return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.retries = 0;
    this.open();
  };

  private readonly onVisibility = (): void => {
    if (document.visibilityState === "visible") {
      if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
      this.wake();
      return;
    }
    if (!this.companyId || this.hiddenTimer) return;
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null;
      const wasOnline = this.everOnline;
      this.close();
      this.everOnline = wasOnline;
      this.setState(wasOnline ? "reconnecting" : "connecting");
    }, HIDDEN_CLOSE_MS);
  };
}
