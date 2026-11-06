import { describe, expect, it } from "vitest";
import { shouldPlayAbertura } from "./abertura";

describe("abertura", () => {
  it("toca ao abrir o app, antes do login ou da tela inicial", () => {
    expect(shouldPlayAbertura("/", false, false)).toBe(true);
    expect(shouldPlayAbertura("/login", false, false)).toBe(true);
    expect(shouldPlayAbertura("/conversas", false, false)).toBe(true);
  });

  it("não repete na mesma sessão nem para quem pede menos movimento", () => {
    expect(shouldPlayAbertura("/", true, false)).toBe(false);
    expect(shouldPlayAbertura("/", false, true)).toBe(false);
  });

  it("não atrasa quem abriu uma conversa pela notificação", () => {
    expect(shouldPlayAbertura("/conversas/abc", false, false)).toBe(false);
  });
});
