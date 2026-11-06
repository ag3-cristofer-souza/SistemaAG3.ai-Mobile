import { describe, expect, it } from "vitest";
import { asPeriod, change, dayRange, formatPercent, instantRange } from "./period";

const NOW = new Date(2026, 10, 6, 15, 30);

describe("período", () => {
  it("em dias locais, conta o dia de hoje", () => {
    expect(dayRange("today", NOW)).toEqual({ start: "2026-11-06", end: "2026-11-06" });
    expect(dayRange("7d", NOW)).toEqual({ start: "2026-10-31", end: "2026-11-06" });
    expect(dayRange("30d", NOW)).toEqual({ start: "2026-10-08", end: "2026-11-06" });
    expect(dayRange("month", NOW)).toEqual({ start: "2026-11-01", end: "2026-11-06" });
  });

  it("em instantes, vai do começo do dia até agora", () => {
    const range = instantRange("today", NOW);
    expect(new Date(range.start).getHours()).toBe(0);
    expect(range.end).toBe(NOW.toISOString());
  });

  it("valor inválido na URL cai em hoje", () => {
    expect(asPeriod("7d")).toBe("7d");
    expect(asPeriod("x")).toBe("today");
    expect(asPeriod(null)).toBe("today");
  });
});

describe("indicadores", () => {
  it("variação sem base não existe", () => {
    expect(change(120, 100)).toBe(20);
    expect(change(50, 100)).toBe(-50);
    expect(change(10, 0)).toBeNull();
  });

  it("formata percentual em português", () => {
    expect(formatPercent(12.34)).toBe("12,3%");
  });
});
