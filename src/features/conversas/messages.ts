import type { InfiniteData } from "@tanstack/react-query";
import { apiUrl } from "@/config/runtimeEnv";
import type { Message, MessagesPage } from "@/api/conversations";

export type MessagesData = InfiniteData<MessagesPage, unknown>;

/** Da mais antiga para a mais nova, sem repetir: uma mensagem nova desloca as páginas e repete itens entre elas. */
export function flattenMessages(data: MessagesData | undefined): Message[] {
  const byId = new Map<string, Message>();
  for (const page of data?.pages ?? []) {
    for (const message of page.data) {
      if (!byId.has(message.id)) byId.set(message.id, message);
    }
  }
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Evento do WebSocket vem sem as colunas pesadas (`payload`): no UPDATE, preserva o que já se tem. */
export function upsertMessage(data: MessagesData, message: Message): MessagesData {
  let found = false;
  const pages = data.pages.map((page) => ({
    ...page,
    data: page.data.map((item) => {
      if (item.id !== message.id) return item;
      found = true;
      return { ...item, ...message, payload: message.payload ?? item.payload };
    }),
  }));
  if (!found && pages[0]) pages[0] = { ...pages[0], data: [message, ...pages[0].data] };
  return { ...data, pages };
}

export function removeMessage(data: MessagesData, id: string): MessagesData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => item.id !== id),
    })),
  };
}

const VIRTUAL_BASE = 1_000_000;

/**
 * `firstItemIndex` do Virtuoso: só pode cair quando entram itens ANTES dos que estão na tela. Mede pela posição de uma
 * mensagem âncora, porque o tamanho das páginas muda com as mensagens novas. Sem a âncora, recomeça dela.
 */
export function firstItemIndex(messages: Message[], anchorId: string | null): number {
  const position = anchorId ? messages.findIndex((item) => item.id === anchorId) : -1;
  return VIRTUAL_BASE - Math.max(position, 0);
}

export interface Quote {
  author: string;
  text: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** A citação vem no corpo (`> *Autor*: texto`, mensagens antigas) ou no `payload`, como o painel interpreta. */
export function parseQuote(message: Message): { quote: Quote | null; body: string } {
  const body = message.body ?? "";
  if (body.startsWith("> ") && body.includes("\n\n")) {
    const [first = "", ...rest] = body.split("\n\n");
    const match = first.match(/> \*([^*]+)\*: (.*)/);
    return {
      quote: match
        ? { author: match[1]!, text: match[2]! }
        : { author: "...", text: first.replace("> ", "") },
      body: rest.join("\n\n"),
    };
  }
  const payload = asRecord(message.payload);
  if (payload.quoted_message_id) {
    return {
      quote: {
        author: String(payload.quoted_author ?? "..."),
        text: String(payload.quoted_text ?? "..."),
      },
      body,
    };
  }
  return { quote: null, body };
}

export type MediaKind = "image" | "audio" | "video" | "document" | "sticker" | null;

/** Mesma leitura do painel (`messageContent.tsx`): o tipo pode estar em `message_type` ou no mime da mídia. */
export function mediaKind(message: Message): MediaKind {
  const type = message.message_type ?? "";
  const mime = message.media_mime_type ?? "";
  if (!message.media_url) return null;
  if (type === "sticker") return "sticker";
  if (type === "audio" || mime.startsWith("audio/") || message.body === "[Áudio]") return "audio";
  if (type === "image" || mime.startsWith("image/") || message.body === "[Imagem]") return "image";
  if (type === "video" || mime.startsWith("video/")) return "video";
  return "document";
}

/** Texto gerado para mídia, que não deve aparecer junto dela. */
export const isMediaPlaceholder = (body: string) => /^\[[^\]\n]{1,30}\]$/.test(body.trim());

/** Nada de `javascript:` e afins: o link vem de mensagem de cliente. Caminho relativo é o storage servido pela API. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, apiUrl() || window.location.origin);
    // `blob:` é a prévia local do arquivo que a própria pessoa está enviando.
    return ["https:", "http:", "blob:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
