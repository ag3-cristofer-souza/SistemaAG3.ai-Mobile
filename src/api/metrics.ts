import { z } from "zod";
import { api } from "./client";

/**
 * Métricas: os mesmos endpoints do painel, para os totais não divergirem. Quem decide o escopo é o servidor: gestor vê a
 * empresa, operador só os próprios números, e os relatórios de marketing recusam operador.
 *
 * Número ausente ou em formato inesperado vira 0, para um indicador novo no backend não derrubar a tela inteira.
 */
const num = z.coerce.number().catch(0);
const nullableNum = z.number().nullable().catch(null);

const zapRowSchema = z.object({
  tipo: z.string().nullish(),
  name: z.string().catch("Sem nome"),
  email: z.string().nullish(),
  contatos: num,
  contatei: num,
  efetivas: num,
  efetividade: num,
  aResponder: num,
  mensagensEnviadas: num,
  mensagensRecebidas: num,
});

const overviewSchema = z.object({
  data: z.object({
    commercial: z.object({
      kpis: z.object({ leadsPeriod: num, conversionsMonth: num, whatsappRedirects: num }).catch({
        leadsPeriod: 0,
        conversionsMonth: 0,
        whatsappRedirects: 0,
      }),
      executiveSummary: z
        .object({
          uniqueContacts: num,
          interestedOrQualified: num,
          conversionsInPeriod: num,
          conversionRatePercent: num,
        })
        .catch({
          uniqueContacts: 0,
          interestedOrQualified: 0,
          conversionsInPeriod: 0,
          conversionRatePercent: 0,
        }),
      previous: z.object({ leads: num, conversions: num }).catch({ leads: 0, conversions: 0 }),
      leadsData: z.array(z.object({ date: z.string(), leads: num })).catch([]),
      teamPerformance: z
        .array(z.object({ userId: z.string().nullish(), name: z.string(), conversions: num }))
        .catch([]),
    }),
    attendance: z
      .object({ new_attendances: num, avg_waiting_time_seconds: num, transfers: num })
      .nullish()
      .catch(null),
    zap: z.object({
      summary: z.object({
        contatos: num,
        contatei: num,
        efetivas: num,
        efetividade: num,
        aResponder: num,
        semRetorno: num,
        contas: num,
        mensagensEnviadas: num,
        mensagensRecebidas: num,
      }),
      rows: z.array(zapRowSchema).catch([]),
    }),
  }),
});

const marketingCountSchema = z.object({ leads: num, ganhos: num, receita: num });

const marketingSchema = z.object({
  data: z.object({
    resumo: marketingCountSchema.extend({
      leads_novos: num,
      qualificados: num,
      taxa_ganho: nullableNum,
      gasto: nullableNum,
      cpl: nullableNum,
      roas: nullableNum,
      sem_origem: num,
      plataforma: z
        .object({ impressoes: num, cliques: num, conversas: num, leads: num })
        .optional()
        .catch(undefined),
    }),
    canais: z
      .array(
        marketingCountSchema.extend({
          canal: z.string(),
          campanhas: z
            .array(marketingCountSchema.extend({ nome: z.string().nullable().catch(null) }))
            .catch([]),
        })
      )
      .catch([]),
    fontes: z
      .array(marketingCountSchema.extend({ fonte: z.string().nullable().catch(null) }))
      .catch([]),
    moeda: z.string().nullable().catch(null),
    tem_gasto: z.boolean().catch(false),
  }),
});

const origemSchema = z.object({
  data: z.object({
    kpis: z.object({ entradas: num, novos: num, ganhos: num, perdidos: num, pendentes: num }),
    mensagens_iniciais: z.array(z.object({ mensagem: z.string(), entradas: num })).catch([]),
  }),
});

const pixelSchema = z.object({
  data: z.array(
    z.object({
      deliveries: z
        .array(z.object({ platform: z.string(), status: z.string() }))
        .optional()
        .catch([]),
    })
  ),
});

export type Overview = z.infer<typeof overviewSchema>["data"];
export type Marketing = z.infer<typeof marketingSchema>["data"];
export type Origem = z.infer<typeof origemSchema>["data"];

export interface PixelSummary {
  sent: number;
  failed: number;
  total: number;
}

interface DateRange {
  start: string;
  end: string;
}

const days = (range: DateRange) => ({ start_date: range.start, end_date: range.end });

export const metricsApi = {
  /** Instantes completos: é como o painel pede, e o servidor guarda em cache por essa chave. */
  overview: async (range: DateRange, agentId?: string): Promise<Overview> =>
    (
      await api.get(
        "/dashboard/overview",
        overviewSchema,
        // `agent_id`: o mesmo filtro de operador do painel. O servidor só aceita de gestor e admin.
        agentId ? { ...days(range), agent_id: agentId } : days(range)
      )
    ).data,
  /** Os relatórios trabalham com dias locais da empresa. */
  marketing: async (range: DateRange): Promise<Marketing> =>
    (await api.get("/reports/marketing/visao", marketingSchema, days(range))).data,
  origem: async (range: DateRange): Promise<Origem> =>
    (await api.get("/reports/entries/origem", origemSchema, days(range))).data,
  /** Só o resumo dos últimos eventos enviados à Meta: a configuração continua no painel. */
  pixel: async (): Promise<PixelSummary> => {
    const { data } = await api.get("/marketing/conversions/events", pixelSchema, { limit: 200 });
    const meta = data.flatMap((event) =>
      (event.deliveries ?? []).filter((delivery) => delivery.platform === "meta")
    );
    return {
      total: meta.length,
      sent: meta.filter((delivery) => delivery.status === "sent").length,
      failed: meta.filter((delivery) => ["failed", "rejected"].includes(delivery.status)).length,
    };
  },
};
