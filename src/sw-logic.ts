/** Regras puras do service worker, separadas para poderem ser testadas. */
export interface PushView {
  title: string;
  body: string;
  url: string;
  tag?: string;
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
    title: asText(notification.title) ?? asText(data.title) ?? "AG3",
    body: asText(notification.body) ?? asText(data.body) ?? "Você tem uma atualização.",
    url: safePath(data.url ?? (conversationId ? `/conversa/${conversationId}` : undefined)),
    tag: conversationId ? `conversa:${conversationId}` : asText(data.tag),
  };
}
