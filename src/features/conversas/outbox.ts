import { ApiError } from "@/api/client";
import {
  conversationsApi,
  type Message,
  type MessageKind,
  type SendBody,
} from "@/api/conversations";

/**
 * Fila de envio do chat. A bolha aparece na hora e o envio é repetido sozinho em falha de rede, sempre com o mesmo
 * `client_message_id`: se a resposta se perdeu no caminho, o servidor devolve a mensagem já criada, sem reenviar ao
 * cliente. Erro de negócio, como a janela de 24 h da Meta, não se repete: mostra o texto do servidor.
 *
 * Fica fora da tela para o envio continuar, e a falha seguir visível, se a pessoa sair do chat. Só em memória: envio
 * offline duradouro está fora da primeira versão.
 */
export interface QuoteDraft {
  author: string;
  text: string;
  messageId: string;
  providerId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
}

export interface Draft {
  kind: MessageKind;
  text: string;
  file?: Blob;
  fileName?: string;
  mimeType?: string;
  quote?: QuoteDraft;
}

export interface OutboxItem {
  clientId: string;
  conversationId: string;
  draft: Draft;
  previewUrl?: string;
  mediaUrl?: string;
  status: "sending" | "failed";
  error?: string;
  createdAt: string;
}

export interface OutboxTransport {
  upload: (conversationId: string, file: Blob, name: string, mime: string) => Promise<string>;
  send: (conversationId: string, body: SendBody) => Promise<Message>;
  attachQuote: (messageId: string, payload: Record<string, unknown>) => Promise<unknown>;
}

export const RETRY_DELAYS_MS = [1_000, 3_000, 7_000];
const MAX_IN_PROGRESS_WAITS = 6;
const DEFAULT_IN_PROGRESS_WAIT_MS = 1_500;

const errorDetail = (error: ApiError) =>
  (error.body as { detail?: { code?: string; retry_after_ms?: number } } | undefined)?.detail;

/** Quanto esperar antes de repetir, ou `null` para desistir. Repetir é seguro porque o id é o mesmo. */
export function retryDelay(error: unknown, attempt: number): number | null {
  if (!(error instanceof ApiError)) return null;
  if (error.isNetwork || error.status >= 500 || error.status === 429) {
    return RETRY_DELAYS_MS[attempt] ?? null;
  }
  const detail = errorDetail(error);
  if (error.status === 409 && detail?.code === "SEND_IN_PROGRESS") {
    return attempt < MAX_IN_PROGRESS_WAITS
      ? (detail.retry_after_ms ?? DEFAULT_IN_PROGRESS_WAIT_MS)
      : null;
  }
  return null;
}

/** Não usa `crypto.randomUUID`: ele não existe fora de HTTPS, como ao testar por IP na rede local. */
export function newClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const quotePayload = (quote: QuoteDraft): Record<string, unknown> => ({
  quoted_message_id: quote.messageId,
  quoted_author: quote.author,
  quoted_text: quote.text,
  ...(quote.providerId ? { quoted_z_api_message_id: quote.providerId } : {}),
  ...(quote.mediaUrl
    ? { quoted_media_url: quote.mediaUrl, quoted_media_mime_type: quote.mediaMimeType ?? null }
    : {}),
});

/** Sem o id do provedor não há citação nativa: como no painel, a citação vai no próprio texto. */
const messageText = ({ text, quote }: Draft) =>
  quote && !quote.providerId ? `> *${quote.author}*: ${quote.text}\n\n${text}` : text;

const EMPTY: OutboxItem[] = [];
const defaultSleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Outbox {
  private items: OutboxItem[] = [];
  private readonly byConversation = new Map<string, OutboxItem[]>();
  private readonly listeners = new Set<() => void>();
  private delivered: ((conversationId: string, message: Message) => void) | null = null;

  constructor(
    private readonly transport: OutboxTransport,
    private readonly sleep: (ms: number) => Promise<unknown> = defaultSleep
  ) {}

  onDelivered(listener: (conversationId: string, message: Message) => void): void {
    this.delivered = listener;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot(conversationId: string): OutboxItem[] {
    return this.byConversation.get(conversationId) ?? EMPTY;
  }

  add(conversationId: string, draft: Draft): OutboxItem {
    const item: OutboxItem = {
      clientId: newClientId(),
      conversationId,
      draft,
      previewUrl: draft.file ? URL.createObjectURL(draft.file) : undefined,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    this.commit([...this.items, item]);
    void this.deliver(item.clientId);
    return item;
  }

  /** Nova tentativa pedida pela pessoa: mesmo id e, se o arquivo já subiu, sem subir de novo. */
  retry(clientId: string): void {
    this.patch(clientId, { status: "sending", error: undefined });
    void this.deliver(clientId);
  }

  discard(clientId: string): void {
    this.remove(clientId);
  }

  /** Ao sair da conta: texto e arquivo que não foram não podem ficar para a próxima pessoa. */
  clear(): void {
    this.items.forEach((item) => this.revoke(item));
    this.commit([]);
  }

  private async deliver(clientId: string): Promise<void> {
    try {
      const mediaUrl = await this.uploadIfNeeded(clientId);
      const item = this.find(clientId);
      if (!item) return;
      const { draft } = item;
      const message = await this.withRetry(() =>
        this.transport.send(item.conversationId, {
          message: messageText(draft),
          media_url: mediaUrl,
          message_type: draft.kind,
          quoted_message_id: draft.quote?.providerId,
          client_message_id: item.clientId,
        })
      );
      const payload = draft.quote ? quotePayload(draft.quote) : undefined;
      if (payload) {
        // O registro nasce sem a citação. Falhar aqui não desfaz o envio: só o histórico perde o destaque.
        void this.transport.attachQuote(message.id, { payload }).catch(() => undefined);
      }
      if (!this.find(clientId)) return;
      this.remove(clientId);
      this.delivered?.(item.conversationId, payload ? { ...message, payload } : message);
    } catch (error) {
      this.patch(clientId, {
        status: "failed",
        error: error instanceof ApiError ? error.detail : "Não foi possível enviar.",
      });
    }
  }

  private async uploadIfNeeded(clientId: string): Promise<string | undefined> {
    const item = this.find(clientId);
    if (!item?.draft.file) return undefined;
    if (item.mediaUrl) return item.mediaUrl;
    const { file, fileName = "arquivo", mimeType = file.type } = item.draft;
    const url = await this.withRetry(() =>
      this.transport.upload(item.conversationId, file, fileName, mimeType)
    );
    this.patch(clientId, { mediaUrl: url });
    return url;
  }

  private async withRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        const delay = retryDelay(error, attempt);
        if (delay === null) throw error;
        await this.sleep(delay);
      }
    }
  }

  private find(clientId: string): OutboxItem | undefined {
    return this.items.find((item) => item.clientId === clientId);
  }

  private patch(clientId: string, fields: Partial<OutboxItem>): void {
    this.commit(
      this.items.map((item) => (item.clientId === clientId ? { ...item, ...fields } : item))
    );
  }

  private remove(clientId: string): void {
    const item = this.find(clientId);
    if (item) this.revoke(item);
    this.commit(this.items.filter((entry) => entry.clientId !== clientId));
  }

  private revoke(item: OutboxItem): void {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }

  private commit(items: OutboxItem[]): void {
    this.items = items;
    this.byConversation.clear();
    for (const item of items) {
      const list = this.byConversation.get(item.conversationId) ?? [];
      list.push(item);
      this.byConversation.set(item.conversationId, list);
    }
    this.listeners.forEach((listener) => listener());
  }
}

export const outbox = new Outbox({
  upload: conversationsApi.upload,
  send: conversationsApi.send,
  attachQuote: conversationsApi.patchMessage,
});

/** Id da bolha local, que nunca colide com o id de uma mensagem do servidor. */
const LOCAL_PREFIX = "local:";
export const isLocalMessage = (message: Message) => message.id.startsWith(LOCAL_PREFIX);
export const clientIdOf = (message: Message) => message.id.slice(LOCAL_PREFIX.length);

export function toLocalMessage(item: OutboxItem): Message {
  const { draft } = item;
  return {
    id: `${LOCAL_PREFIX}${item.clientId}`,
    conversation_id: item.conversationId,
    direction: "out",
    sender_type: "agent",
    body: draft.text,
    payload: draft.quote ? quotePayload(draft.quote) : undefined,
    message_type: draft.kind,
    media_url: item.previewUrl,
    media_mime_type: draft.mimeType,
    media_caption: draft.kind === "document" ? draft.fileName : undefined,
    delivery_status: item.status === "failed" ? "failed" : "sending",
    created_at: item.createdAt,
  };
}

const SAME_MESSAGE_WINDOW_MS = 60_000;

/**
 * O WebSocket pode trazer a mensagem antes de o envio responder. Para não mostrar duas bolhas nesse intervalo, esconde a
 * local quando já há uma mensagem do operador com o mesmo texto. Cada mensagem do servidor cobre uma bolha só, e uma
 * bolha com falha continua visível. A margem de 1 minuto cobre a diferença de relógio com o servidor.
 */
export function pendingBubbles(items: OutboxItem[], messages: Message[]): OutboxItem[] {
  const taken = new Set<string>();
  return items.filter((item) => {
    if (item.status === "failed" || item.draft.file) return true;
    const sentAt = new Date(item.createdAt).getTime();
    const text = messageText(item.draft);
    const match = messages.find(
      (message) =>
        !taken.has(message.id) &&
        message.sender_type === "agent" &&
        (message.body ?? "") === text &&
        new Date(message.created_at).getTime() >= sentAt - SAME_MESSAGE_WINDOW_MS
    );
    if (!match) return true;
    taken.add(match.id);
    return false;
  });
}
