import { describe, expect, it } from "vitest";
import { formatDayLabel, formatDuration, formatListTime, initials } from "./format";

const NOW = new Date(2026, 10, 6, 15, 30);
const at = (...args: [number, number, number, number?, number?]) => new Date(...args).toISOString();

describe("datas", () => {
  it("na lista, mostra hora de hoje, ontem ou a data", () => {
    expect(formatListTime(at(2026, 10, 6, 9, 5), NOW)).toBe("09:05");
    expect(formatListTime(at(2026, 10, 5, 23, 59), NOW)).toBe("Ontem");
    expect(formatListTime(at(2026, 9, 20, 8), NOW)).toBe("20/10");
    expect(formatListTime(at(2025, 0, 3, 8), NOW)).toBe("03/01/25");
    expect(formatListTime(null, NOW)).toBe("");
  });

  it("separa o chat por dia", () => {
    expect(formatDayLabel(at(2026, 10, 6, 1), NOW)).toBe("Hoje");
    expect(formatDayLabel(at(2026, 10, 5, 1), NOW)).toBe("Ontem");
    expect(formatDayLabel(at(2026, 2, 9, 1), NOW)).toBe("9 de março");
    expect(formatDayLabel(at(2025, 2, 9, 1), NOW)).toBe("9 de março de 2025");
  });
});

describe("duração", () => {
  it.each([
    [0, "0 s"],
    [59, "59 s"],
    [60, "1 min"],
    [3600, "1 h"],
    [3660, "1 h 1 min"],
    [86_400, "1 d"],
    [90_000, "1 d 1 h"],
    [-5, "0 s"],
  ])("%d segundos: %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe("iniciais", () => {
  it("usa o primeiro e o último nome", () => {
    expect(initials("Ana Maria Souza")).toBe("AS");
    expect(initials("ana")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});
