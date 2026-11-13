import { describe, expect, it } from "vitest";
import type { LiveChannel } from "@/api/dashboard";
import { channelAlerts, messagingLimitLabel, providerLabel, qualityLabel } from "./channels";

const NOW = new Date("2026-11-12T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();

const base: LiveChannel = {
  id: "i1",
  name: "Vendas",
  number: "5511911112222",
  status: "connected",
  connected: true,
  provider: "zapi",
  owner: "Olga",
  team: [],
  ai_assistant: null,
  pending: 0,
  unassigned: 0,
  last_message_at: daysAgo(0),
  sync_error: false,
  number_changed_at: null,
  previous_number: null,
  meta: null,
};

const meta: NonNullable<LiveChannel["meta"]> = {
  mode: "api_only",
  keepalive_status: "healthy",
  last_keepalive_at: null,
  quality: "GREEN",
  messaging_limit: "TIER_1K",
  situacao: "disponivel",
  problemas: [],
  checked_at: null,
};

const titles = (channel: LiveChannel) => channelAlerts(channel, NOW).map((a) => a.title);

describe("channelAlerts", () => {
  it("canal saudável não tem alerta", () => {
    expect(channelAlerts(base, NOW)).toEqual([]);
    expect(channelAlerts({ ...base, provider: "meta", meta }, NOW)).toEqual([]);
  });

  it("desconectado vem primeiro, antes da fila do canal", () => {
    const alerts = channelAlerts({ ...base, connected: false, unassigned: 3 }, NOW);
    expect(alerts.map((a) => [a.tone, a.title])).toEqual([
      ["danger", "Sem conexão"],
      ["warning", "3 conversas sem operador neste canal"],
    ]);
  });

  it("Meta bloqueada mostra o motivo e o que fazer", () => {
    const alerts = channelAlerts(
      {
        ...base,
        meta: {
          ...meta,
          situacao: "bloqueada",
          problemas: [
            {
              codigo: 141006,
              titulo: "Erro no meio de pagamento",
              acao: "Troque o cartão.",
              gravidade: "bloqueada",
            },
          ],
        },
      },
      NOW
    );
    expect(alerts.slice(0, 2)).toEqual([
      expect.objectContaining({ tone: "danger", title: "Envio bloqueado pela Meta" }),
      { tone: "danger", title: "Erro no meio de pagamento (141006)", detail: "Troque o cartão." },
    ]);
  });

  it("qualidade e uso do app no modo coexistência", () => {
    expect(titles({ ...base, meta: { ...meta, quality: "RED" } })).toEqual([
      "Qualidade do número baixa",
    ]);
    expect(titles({ ...base, meta: { ...meta, quality: "YELLOW" } })).toEqual([
      "Qualidade do número em atenção",
    ]);
    expect(
      titles({ ...base, meta: { ...meta, mode: "coexistence", keepalive_status: "critical" } })
    ).toEqual(["WhatsApp Business sem uso há 12 dias ou mais"]);
    // Só API: o uso do app não importa.
    expect(titles({ ...base, meta: { ...meta, keepalive_status: "critical" } })).toEqual([]);
  });

  it("conectado e calado há 3 dias ou mais pede conferência", () => {
    expect(titles({ ...base, last_message_at: daysAgo(2) })).toEqual([]);
    expect(titles({ ...base, last_message_at: daysAgo(4) })).toEqual([
      "Nenhuma mensagem há 4 dias",
    ]);
    // Desconectado já tem o alerta dele; o silêncio é consequência.
    expect(titles({ ...base, connected: false, last_message_at: daysAgo(9) })).toEqual([
      "Sem conexão",
    ]);
  });

  it("sem responsável, troca de número recente e erro de perfil são avisos leves", () => {
    const alerts = channelAlerts(
      {
        ...base,
        owner: null,
        team: [],
        number_changed_at: daysAgo(5),
        previous_number: "5511900001111",
        sync_error: true,
      },
      NOW
    );
    expect(alerts.every((a) => a.tone === "info")).toBe(true);
    expect(alerts.map((a) => a.title)).toEqual([
      "Ninguém da equipe responde por este canal",
      "O número mudou em 07/11",
      "Não foi possível atualizar o perfil deste número",
    ]);
    expect(alerts[1]?.detail).toBe("Antes era (11) 90000-1111.");
    expect(titles({ ...base, number_changed_at: daysAgo(40) })).toEqual([]);
  });
});

describe("rótulos", () => {
  it("traduz provedor, limite e qualidade", () => {
    expect(providerLabel("meta")).toBe("Meta (API oficial)");
    expect(providerLabel("outro")).toBe("outro");
    expect(providerLabel(null)).toBe("Não informado");
    expect(messagingLimitLabel("TIER_1K")).toBe("1 mil conversas por dia");
    expect(messagingLimitLabel(null)).toBeNull();
    expect(qualityLabel("green")).toBe("Alta");
  });
});
