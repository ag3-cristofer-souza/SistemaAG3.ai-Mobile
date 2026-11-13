import { describe, expect, it } from "vitest";
import type { Message } from "@/api/conversations";
import {
  shouldShowSender,
  firstItemIndex,
  flattenMessages,
  isMediaPlaceholder,
  mediaKind,
  parseQuote,
  removeMessage,
  safeMediaUrl,
  upsertMessage,
  type MessagesData,
} from "./messages";

const msg = (id: string, minute = 0, extra: Partial<Message> = {}): Message => ({
  id,
  created_at: `2026-11-06T12:${String(minute).padStart(2, "0")}:00Z`,
  ...extra,
});

const data = (...pages: Message[][]): MessagesData => ({
  pages: pages.map((items, index) => ({ data: items, page: index + 1 })),
  pageParams: pages.map((_, index) => index + 1),
});

describe("lista do chat", () => {
  it("ordena da mais antiga para a mais nova e não repete entre páginas", () => {
    const list = flattenMessages(data([msg("c", 3), msg("b", 2)], [msg("b", 2), msg("a", 1)]));
    expect(list.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("mensagem nova entra na primeira página", () => {
    const next = upsertMessage(data([msg("a", 1)]), msg("b", 2));
    expect(next.pages[0]!.data.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("atualização mantém o payload, que o WebSocket não envia", () => {
    const start = data([msg("a", 1, { payload: { quoted_text: "oi" }, delivery_status: "sent" })]);
    const next = upsertMessage(start, msg("a", 1, { delivery_status: "read" }));
    expect(next.pages[0]!.data[0]).toMatchObject({
      delivery_status: "read",
      payload: { quoted_text: "oi" },
    });
  });

  it("remove em qualquer página", () => {
    const next = removeMessage(data([msg("b", 2)], [msg("a", 1)]), "a");
    expect(next.pages[1]!.data).toEqual([]);
  });

  it("o índice do Virtuoso só muda quando entram mensagens antes da âncora", () => {
    const base = firstItemIndex([msg("a")], "a");
    expect(firstItemIndex([msg("a"), msg("nova")], "a")).toBe(base);
    expect(firstItemIndex([msg("x"), msg("y"), msg("a")], "a")).toBe(base - 2);
    expect(firstItemIndex([msg("x")], "sumiu")).toBe(base);
  });
});

describe("citação", () => {
  it("lê do corpo, no formato antigo", () => {
    expect(parseQuote(msg("a", 0, { body: "> *Ana*: bom dia\n\nresposta" }))).toEqual({
      quote: { author: "Ana", text: "bom dia" },
      body: "resposta",
    });
  });

  it("lê do payload", () => {
    const parsed = parseQuote(
      msg("a", 0, {
        body: "resposta",
        payload: { quoted_message_id: "m1", quoted_author: "Ana", quoted_text: "bom dia" },
      })
    );
    expect(parsed.quote).toEqual({ author: "Ana", text: "bom dia" });
    expect(parsed.body).toBe("resposta");
  });

  it("mensagem comum não tem citação", () => {
    expect(parseQuote(msg("a", 0, { body: "oi" })).quote).toBeNull();
  });
});

describe("mídia", () => {
  it.each([
    [{ message_type: "image" }, "image"],
    [{ media_mime_type: "image/png" }, "image"],
    [{ message_type: "audio" }, "audio"],
    [{ media_mime_type: "audio/ogg" }, "audio"],
    [{ media_mime_type: "video/mp4" }, "video"],
    [{ message_type: "sticker" }, "sticker"],
    [{ media_mime_type: "application/pdf" }, "document"],
  ])("%o é %s", (fields, kind) => {
    expect(mediaKind(msg("a", 0, { media_url: "https://x/a", ...fields }))).toBe(kind);
  });

  it("sem link, não há mídia", () => {
    expect(mediaKind(msg("a", 0, { message_type: "image" }))).toBeNull();
  });

  it("reconhece o texto gerado para mídia", () => {
    expect(isMediaPlaceholder("[Imagem]")).toBe(true);
    expect(isMediaPlaceholder("[Áudio]")).toBe(true);
    expect(isMediaPlaceholder("olha [isso] aqui")).toBe(false);
  });

  it("recusa link que não seja http", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeMediaUrl("https://cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(safeMediaUrl(null)).toBeNull();
  });
});

describe("nome no balão", () => {
  const base = { id: "x", created_at: "2026-11-06T12:00:00Z" };
  const contato = { ...base, direction: "in", sender_type: "user", sender_name: "Katia" };
  const agente = { ...base, direction: "out", sender_type: "agent", sender_name: "Lia" };
  const ia = { ...base, direction: "out", sender_type: "ai" };

  it("conversa individual não repete o nome do contato", () => {
    expect(shouldShowSender(contato, undefined, false)).toBe(false);
  });

  it("no grupo, o nome aparece só na primeira de uma sequência", () => {
    expect(shouldShowSender(contato, undefined, true)).toBe(true);
    expect(shouldShowSender(contato, contato, true)).toBe(false);
    expect(shouldShowSender({ ...contato, sender_name: "Rui" }, contato, true)).toBe(true);
  });

  it("de quem enviou: muda o remetente ou o dia, o nome volta", () => {
    expect(shouldShowSender(agente, agente, false)).toBe(false);
    expect(shouldShowSender(ia, agente, false)).toBe(true);
    expect(shouldShowSender(agente, { ...agente, created_at: "2026-11-05T12:00:00Z" }, false)).toBe(
      true
    );
  });
});
