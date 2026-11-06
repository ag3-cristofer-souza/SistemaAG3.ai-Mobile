import { describe, expect, it } from "vitest";
import { z } from "zod";
import { api, ApiError, formatDetail, MISSING_CONFIG } from "./client";

describe("formatDetail", () => {
  it("usa o texto do backend", () => {
    expect(formatDetail({ detail: "E-mail ou senha inválidos." }, 401)).toBe(
      "E-mail ou senha inválidos."
    );
  });

  it("junta erros de validação", () => {
    expect(formatDetail({ detail: [{ msg: "a" }, "b"] }, 422)).toBe("a; b");
  });

  it("não mostra página de erro de proxy", () => {
    expect(formatDetail("<html><title>405 Not Allowed</title></html>", 405)).toBe("Erro 405");
    expect(formatDetail("  <!doctype html><p>x</p>", 502)).toBe("Erro 502");
  });

  it("cai no status quando não há texto", () => {
    expect(formatDetail(null, 500)).toBe("Erro 500");
    expect(formatDetail({ detail: {} }, 503)).toBe("Erro 503");
  });
});

describe("ApiError", () => {
  it("identifica falha de rede pelo status 0", () => {
    expect(new ApiError(0, "x").isNetwork).toBe(true);
    expect(new ApiError(500, "x").isNetwork).toBe(false);
  });
});

describe("sem o endereço da API", () => {
  it("avisa em vez de mandar o pedido para o próprio site do app", async () => {
    await expect(api.post("/auth/login", z.unknown(), {})).rejects.toThrow(MISSING_CONFIG);
  });
});
