/** Regras puras do service worker, separadas para poderem ser testadas. */
export type PushKind =
  | "new_message"
  | "conversation_assigned"
  | "conversation_transferred"
  | "agenda"
  | "manager_alert"
  | "test"
  | "generic";

export interface PushView {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Foto do contato, quando houver. Sem ela, o ícone é o do tipo de aviso. */
  image?: string;
  renotify: boolean;
}

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict =>
  value && typeof value === "object" ? (value as Dict) : {};
const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

/** Só caminhos do próprio app: um payload não pode mandar o usuário para outro site. */
export function safePath(value: unknown): string {
  const path = asText(value);
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

const KINDS: readonly PushKind[] = [
  "new_message",
  "conversation_assigned",
  "conversation_transferred",
  "agenda",
  "manager_alert",
  "test",
];

const asKind = (value: unknown): PushKind =>
  KINDS.includes(value as PushKind) ? (value as PushKind) : "generic";

const asHttps = (value: unknown): string | undefined => {
  const text = asText(value);
  return text?.startsWith("https://") ? text : undefined;
};

/**
 * Aceita o formato do FCM (`notification` + `data`). Sempre devolve algo para exibir: o iPhone retira a permissão de
 * quem recebe push sem mostrar notificação.
 */
export function parsePush(raw: unknown): PushView {
  const payload = asDict(raw);
  const notification = asDict(payload.notification);
  const data = asDict(payload.data);
  const conversationId = asText(data.conversation_id);
  return {
    kind: asKind(data.type),
    title: asText(notification.title) ?? asText(data.title) ?? "AG3",
    body: asText(notification.body) ?? asText(data.body) ?? "Você tem uma atualização.",
    url: safePath(data.url ?? (conversationId ? `/conversas/${conversationId}` : undefined)),
    tag: conversationId ? `conversa:${conversationId}` : asText(data.tag),
    image: asHttps(data.image),
    renotify: data.renotify !== "0",
  };
}

/** Aparência de cada tipo. O ícone pequeno da barra precisa ser branco e transparente: o Android só usa o formato dele. */
const LOOK: Record<PushKind, { icon: string; vibrate: number[]; action: string }> = {
  new_message: {
    icon: "/icons/aviso-mensagem.png",
    vibrate: [120, 80, 120],
    action: "Abrir conversa",
  },
  conversation_assigned: {
    icon: "/icons/aviso-fila.png",
    vibrate: [220, 100, 220],
    action: "Ver conversa",
  },
  conversation_transferred: {
    icon: "/icons/aviso-transferencia.png",
    vibrate: [220, 100, 220],
    action: "Ver conversa",
  },
  agenda: { icon: "/icons/aviso-agenda.png", vibrate: [220, 100, 220], action: "Ver compromisso" },
  manager_alert: {
    icon: "/icons/aviso-alerta.png",
    vibrate: [220, 100, 220],
    action: "Ver painel",
  },
  test: { icon: "/icons/aviso-ativo.png", vibrate: [120], action: "Abrir o app" },
  generic: { icon: "/icons/aviso-ativo.png", vibrate: [120], action: "Abrir o app" },
};

/** `renotify` e `vibrate` existem nos navegadores, mas ainda não nos tipos do TypeScript. */
export type PushOptions = NotificationOptions & {
  renotify?: boolean;
  vibrate?: number[];
  timestamp?: number;
  actions?: Array<{ action: string; title: string }>;
};

export function notificationOptions(view: PushView, now = Date.now()): PushOptions {
  const look = LOOK[view.kind];
  return {
    body: view.body,
    icon: view.image ?? look.icon,
    badge: "/icons/aviso-barra.png",
    tag: view.tag,
    // O navegador recusa `renotify` em notificação sem `tag`.
    renotify: Boolean(view.tag) && view.renotify,
    silent: !view.renotify,
    vibrate: look.vibrate,
    timestamp: now,
    actions: [{ action: "open", title: look.action }],
    data: { url: view.url },
  };
}

/** Empresa que o aviso pede, para abrir a conversa na empresa certa mesmo com outra selecionada. */
export const WORKSPACE_PARAM = "empresa";
