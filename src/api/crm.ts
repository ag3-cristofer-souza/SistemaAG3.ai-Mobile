import { z } from "zod";
import { api } from "./client";

/** Card do lead no board. O servidor só devolve os que o usuário pode ver: operador, os dele e os sem dono. */
const cardSchema = z.object({
  id: z.string(),
  lead_id: z.string().nullish(),
  pipeline_id: z.string().nullish(),
  status: z.string().nullish(),
  assigned_to: z.string().nullish(),
  closed_at: z.string().nullish(),
  assignedToName: z.string().nullish(),
});
const stageSchema = z.object({
  key: z.string(),
  label: z.string(),
  position: z.number().nullish(),
});
const pipelineSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  is_default: z.boolean().nullish(),
});
const leadSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  company_name: z.string().nullish(),
  source: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  created_at: z.string().nullish(),
});
const historySchema = z.object({
  id: z.string(),
  kind: z.string(),
  created_at: z.string(),
  from_label: z.string().nullable(),
  to_label: z.string().nullable(),
  description: z.string().nullable(),
  actor_name: z.string(),
});
const noteSchema = z.object({
  id: z.string(),
  content: z.string().nullish(),
  created_at: z.string().nullish(),
});
const originSchema = z.object({
  data: z.object({
    resumo: z.object({ primeira: z.object({ label: z.string() }).optional() }),
  }),
});

const list = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });

export type LeadCard = z.infer<typeof cardSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type Pipeline = z.infer<typeof pipelineSchema>;
export type LeadDetail = z.infer<typeof leadSchema>;
export type HistoryItem = z.infer<typeof historySchema>;
export type LeadNote = z.infer<typeof noteSchema>;

export const crmApi = {
  /** Abertos e fechados: mover para "Convertido" fecha o card, e ele precisa continuar aparecendo. */
  cards: async (leadId: string): Promise<LeadCard[]> =>
    (
      await api.get("/produtos", list(cardSchema), {
        lead_id: leadId,
        limit: 100,
        sort_by: "updated_at",
        sort_order: "desc",
      })
    ).data,
  pipelines: async (): Promise<Pipeline[]> =>
    (await api.get("/pipelines", list(pipelineSchema))).data,
  stages: async (pipelineId: string): Promise<Stage[]> =>
    (await api.get("/pipelines/stages/all", list(stageSchema), { pipeline_id: pipelineId })).data,
  dynamicStatuses: async (): Promise<string[]> =>
    (await api.get("/produtos/dynamic-statuses", list(z.object({ status: z.string() })))).data.map(
      (item) => item.status
    ),
  moveCard: (cardId: string, status: string) =>
    api.put(`/produtos/${cardId}`, z.unknown(), { status }),
  assumeCard: (cardId: string) => api.post(`/produtos/${cardId}/assume`, z.unknown(), {}),
  lead: async (leadId: string): Promise<LeadDetail> =>
    (await api.get(`/leads/${leadId}`, z.object({ data: leadSchema }), { enrich: "false" })).data,
  history: async (leadId: string): Promise<HistoryItem[]> =>
    (await api.get(`/leads/${leadId}/history`, list(historySchema))).data,
  firstOrigin: async (leadId: string): Promise<string | null> =>
    (await api.get(`/leads/${leadId}/origem`, originSchema)).data.resumo.primeira?.label ?? null,
  notes: async (leadId: string): Promise<LeadNote[]> =>
    (await api.get("/notes", list(noteSchema), { lead_id: leadId })).data,
  addNote: (leadId: string, content: string) =>
    api.post("/notes", z.unknown(), { lead_id: leadId, content }),
};
