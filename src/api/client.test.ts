import { describe, expect, it } from "vitest";
import { ApiError, formatDetail } from "./client";

describe("formatDetail", () => {
  it("usa o texto do backend", () => {
    expect(formatDetail({ detail: "E-mail ou senha inválidos." }, 401)).toBe(
      "E-mail ou senha inválidos."
    );
  });

  it("junta erros de validação", () => {
    expect(formatDetail({ detail: [{ msg: "a" }, "b"] }, 422)).toBe("a; b");
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
