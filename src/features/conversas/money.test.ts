import { describe, expect, it } from "vitest";
import { cardValueInput, formatCardValue, parseCardValue } from "./money";

const brl = (text: string) => text.replace(/\s/g, " ");

describe("valor da venda do card", () => {
  it("lê o jeito brasileiro, o teclado com ponto e o vazio", () => {
    expect(parseCardValue("1.500,50")).toBe(1500.5);
    expect(parseCardValue("R$ 1500,5")).toBe(1500.5);
    expect(parseCardValue("1500.50")).toBe(1500.5);
    expect(parseCardValue("1.500")).toBe(1500);
    expect(parseCardValue("2.350.000")).toBe(2350000);
    expect(parseCardValue("0,99")).toBe(0.99);
    expect(parseCardValue("  ")).toBe(0);
  });

  it("recusa o que não é valor", () => {
    for (const text of ["abc", "-10", "1,234", "1.5.0", "12,3,4", "1.50,00", "9999999999999"]) {
      expect(parseCardValue(text)).toBeNull();
    }
  });

  it("mostra em reais e volta ao campo no mesmo formato", () => {
    expect(brl(formatCardValue(1500.5)!)).toBe("R$ 1.500,50");
    expect(formatCardValue(0)).toBeNull();
    expect(formatCardValue(null)).toBeNull();
    expect(cardValueInput(1500.5)).toBe("1.500,50");
    expect(cardValueInput(null)).toBe("");
    expect(parseCardValue(cardValueInput(2350000))).toBe(2350000);
  });
});
