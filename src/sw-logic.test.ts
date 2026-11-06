import { describe, expect, it } from "vitest";
import { notificationOptions, parsePush, safePath } from "./sw-logic";

describe("safePath", () => {
  it("aceita caminho do app", () => {
    expect(safePath("/conversas/1")).toBe("/conversas/1");
  });

  it("recusa endereço de outro site", () => {
    expect(safePath("https://malicioso.example")).toBe("/");
    expect(safePath("//malicioso.example")).toBe("/");
    expect(safePath("/\\malicioso.example")).toBe("/");
    expect(safePath(undefined)).toBe("/");
  });
});

describe("parsePush", () => {
  it("lê o formato do FCM", () => {
    const view = parsePush({
      notification: { title: "Maria", body: "Nova mensagem" },
      data: { conversation_id: "c1" },
    });
    expect(view).toEqual({
      kind: "generic",
      title: "Maria",
      body: "Nova mensagem",
      url: "/conversas/c1",
      tag: "conversa:c1",
      image: undefined,
      renotify: true,
    });
  });

  it("sempre tem o que exibir, mesmo com payload vazio ou inválido", () => {
    for (const payload of [null, undefined, "x", {}]) {
      const view = parsePush(payload);
      expect(view.title).toBe("AG3");
      expect(view.body).toBeTruthy();
      expect(view.url).toBe("/");
    }
  });

  it("não aceita link externo no payload", () => {
    expect(parsePush({ data: { url: "https://malicioso.example" } }).url).toBe("/");
  });
});

describe("aparência por tipo", () => {
  const view = (data: Record<string, string>) =>
    parsePush({ data: { title: "Maria", body: "Nova mensagem", ...data } });
  const options = (data: Record<string, string>) => notificationOptions(view(data), 1000);

  it("cada tipo tem ícone e ação próprios", () => {
    expect(options({ type: "new_message" })).toMatchObject({
      icon: "/icons/aviso-mensagem.png",
      actions: [{ action: "open", title: "Abrir conversa" }],
    });
    expect(options({ type: "conversation_assigned" }).icon).toBe("/icons/aviso-fila.png");
    expect(options({ type: "conversation_transferred" }).icon).toBe(
      "/icons/aviso-transferencia.png"
    );
    expect(options({ type: "agenda" })).toMatchObject({
      icon: "/icons/aviso-agenda.png",
      actions: [{ action: "open", title: "Ver compromisso" }],
    });
    expect(options({ type: "inventado" }).icon).toBe("/icons/aviso-ativo.png");
  });

  it("o ícone da barra é sempre o monocromático", () => {
    expect(options({ type: "new_message" }).badge).toBe("/icons/aviso-barra.png");
  });

  it("usa a foto do contato só se for https", () => {
    expect(options({ type: "new_message", image: "https://cdn/foto.jpg" }).icon).toBe(
      "https://cdn/foto.jpg"
    );
    expect(options({ type: "new_message", image: "http://cdn/foto.jpg" }).icon).toBe(
      "/icons/aviso-mensagem.png"
    );
    expect(options({ type: "new_message", image: "javascript:alert(1)" }).icon).toBe(
      "/icons/aviso-mensagem.png"
    );
  });

  it("mensagens seguidas atualizam em silêncio", () => {
    const seguinte = options({ type: "new_message", conversation_id: "c1", renotify: "0" });
    expect(seguinte).toMatchObject({ tag: "conversa:c1", renotify: false, silent: true });
    const primeira = options({ type: "new_message", conversation_id: "c1", renotify: "1" });
    expect(primeira).toMatchObject({ renotify: true, silent: false });
  });

  it("sem tag, não pede renotify: o navegador recusaria a notificação", () => {
    expect(options({ type: "test" }).renotify).toBe(false);
  });
});
