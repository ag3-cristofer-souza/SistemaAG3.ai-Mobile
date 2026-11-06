import { describe, expect, it } from "vitest";
import type { CalendarItem } from "@/api/calendar";
import {
  addMonths,
  dayKey,
  daysWithItems,
  durationLabel,
  durationOf,
  formatShortDay,
  itemBadge,
  itemsOfDay,
  monthGrid,
  monthWindow,
  nextHalfHour,
  parseDay,
  parseItemRef,
  toIso,
  weekOf,
} from "./calendar";

const at = (...args: [number, number, number, number?, number?]) => new Date(...args).toISOString();

const item = (fields: Partial<CalendarItem>): CalendarItem => ({
  kind: "event",
  id: "1",
  title: "Reunião",
  description: null,
  start_at: at(2026, 10, 6, 14),
  end_at: at(2026, 10, 6, 14, 30),
  status: "confirmed",
  done: false,
  overdue: false,
  attendance: null,
  type: null,
  owner: null,
  lead: null,
  meet_link: null,
  ...fields,
});

describe("semana", () => {
  it("começa na segunda, mesmo vindo de um domingo", () => {
    const week = weekOf(new Date(2026, 10, 8)); // domingo
    expect(dayKey(week[0]!)).toBe("2026-11-02");
    expect(dayKey(week[6]!)).toBe("2026-11-08");
  });

  it("a grade do mês tem só semanas inteiras, da segunda ao domingo", () => {
    const novembro = monthGrid(new Date(2026, 10, 18));
    expect(dayKey(novembro[0]!)).toBe("2026-10-26");
    expect(dayKey(novembro[novembro.length - 1]!)).toBe("2026-12-06");
    expect(novembro).toHaveLength(42);
    // Fevereiro de 2027 começa na segunda e termina no domingo: bastam quatro semanas.
    expect(monthGrid(new Date(2027, 1, 10))).toHaveLength(28);
  });

  it("a janela do feed cobre a grade inteira e fica dentro do limite do servidor", () => {
    const { from, to } = monthWindow(new Date(2026, 10, 18));
    expect(new Date(from)).toEqual(new Date(2026, 9, 26));
    expect(new Date(to)).toEqual(new Date(2026, 11, 7));
  });

  it("muda de mês sem pular o mês mais curto", () => {
    expect(dayKey(addMonths(new Date(2027, 0, 31), 1))).toBe("2027-02-28");
    expect(dayKey(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-15");
    expect(dayKey(addMonths(new Date(2027, 0, 15), -1))).toBe("2026-12-15");
  });

  it("converte a chave do dia nos dois sentidos, no fuso local", () => {
    expect(dayKey(parseDay("2026-03-09"))).toBe("2026-03-09");
    expect(new Date(toIso("2026-11-06", "14:30")).getHours()).toBe(14);
  });
});

describe("itens", () => {
  it("filtra o dia e ordena pelo horário", () => {
    const list = [
      item({ id: "b", start_at: at(2026, 10, 6, 15) }),
      item({ id: "a", start_at: at(2026, 10, 6, 9) }),
      item({ id: "c", start_at: at(2026, 10, 7, 9) }),
    ];
    expect(itemsOfDay(list, "2026-11-06").map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(daysWithItems(list)).toEqual(new Set(["2026-11-06", "2026-11-07"]));
  });

  it("calcula a duração", () => {
    expect(durationOf(item({}))).toBe(30);
    expect(formatShortDay(at(2026, 2, 9, 14))).toBe("09/03");
    expect([45, 60, 90, 120].map(durationLabel)).toEqual(["45 min", "1h", "1h30", "2h"]);
  });

  it("sugere a próxima meia hora", () => {
    expect(nextHalfHour(new Date(2026, 10, 6, 14, 10))).toBe("14:30");
    expect(nextHalfHour(new Date(2026, 10, 6, 14, 40))).toBe("15:00");
  });
});

describe("situação do item", () => {
  const depois = new Date(2026, 10, 7);
  const antes = new Date(2026, 10, 5);

  it("evento passado sem marcação pede presença", () => {
    expect(itemBadge(item({}), depois)?.label).toBe("Marcar presença");
    expect(itemBadge(item({}), antes)).toBeNull();
    expect(itemBadge(item({ attendance: "done" }), depois)?.label).toBe("Realizado");
    expect(itemBadge(item({ attendance: "no_show" }), depois)?.tone).toBe("bad");
  });

  it("tarefa mostra concluída ou atrasada", () => {
    expect(itemBadge(item({ kind: "task", done: true }), depois)?.label).toBe("Concluída");
    expect(itemBadge(item({ kind: "task", overdue: true }), depois)?.label).toBe("Atrasada");
    expect(itemBadge(item({ kind: "task" }), antes)).toBeNull();
  });

  it("cancelado vale para qualquer um", () => {
    expect(itemBadge(item({ status: "cancelled" }), antes)?.label).toBe("Cancelado");
  });
});

describe("link da notificação", () => {
  it("só aceita os dois tipos", () => {
    expect(parseItemRef("event:abc")).toEqual({ kind: "event", id: "abc" });
    expect(parseItemRef("task:abc")).toEqual({ kind: "task", id: "abc" });
    expect(parseItemRef("outro:abc")).toBeNull();
    expect(parseItemRef("event:")).toBeNull();
    expect(parseItemRef(null)).toBeNull();
  });
});
