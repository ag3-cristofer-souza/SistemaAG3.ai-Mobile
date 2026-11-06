import { describe, expect, it } from "vitest";
import { parsePush, safePath } from "./sw-logic";

describe("safePath", () => {
  it("aceita caminho do app", () => {
    expect(safePath("/conversa/1")).toBe("/conversa/1");
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
      title: "Maria",
      body: "Nova mensagem",
      url: "/conversa/c1",
      tag: "conversa:c1",
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
