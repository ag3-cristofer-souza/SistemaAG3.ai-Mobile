import { describe, expect, it } from "vitest";
import type { LiveOperator } from "@/api/dashboard";
import { operatorAlerts, presenceLabel } from "./team";

const NOW = new Date("2026-11-13T12:00:00Z").getTime();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();
const DAY = 24 * 3600;

const base: LiveOperator = {
  user_id: "u1",
  name: "Olga",
  online: true,
  systems: ["mobile", "painel"],
  active: 1,
  in_attendance: 2,
  on_hold: 0,
  limit: 5,
  oldest_active_seconds: 120,
  last_seen_at: ago(30),
};

const titles = (operator: LiveOperator, age = 0) =>
  operatorAlerts(operator, NOW, age).map((alert) => [alert.tone, alert.title]);

describe("operatorAlerts", () => {
  it("online, dentro do limite e respondendo: nada a dizer", () => {
    expect(titles(base)).toEqual([]);
  });

  it("a espera do aceite conta o tempo desde a foto do servidor", () => {
    expect(titles({ ...base, oldest_active_seconds: 3000 })).toEqual([]);
    expect(titles({ ...base, oldest_active_seconds: 3000 }, 900)).toEqual([
      ["warning", "A mais antiga espera o aceite há 1 h 5 min"],
    ]);
  });

  it("conversa esquecida, no limite e offline, do mais grave ao mais leve", () => {
    const operator = {
      ...base,
      online: false,
      systems: [],
      active: 299,
      limit: 5,
      oldest_active_seconds: 70 * DAY,
      last_seen_at: ago(10 * DAY),
    };
    expect(titles(operator)).toEqual([
      ["danger", "A mais antiga espera o aceite há 70 d"],
      ["warning", "No limite de conversas"],
      ["warning", "Offline com 299 conversas esperando o aceite"],
      ["info", "Sem acessar há 10 dias"],
    ]);
  });

  it("offline sem registro de acesso", () => {
    expect(
      titles({ ...base, online: false, active: 0, oldest_active_seconds: null, last_seen_at: null })
    ).toEqual([["info", "Sem registro de acesso ao app ou ao painel"]]);
  });
});

describe("presenceLabel", () => {
  it("diz onde está, ou quando foi visto", () => {
    expect(presenceLabel(base, NOW)).toBe("Online no App e Painel");
    expect(presenceLabel({ ...base, online: false, last_seen_at: ago(2 * DAY) }, NOW)).toBe(
      "Offline, visto há 2 d"
    );
    expect(presenceLabel({ ...base, online: false, last_seen_at: null }, NOW)).toBe("Offline");
  });
});
