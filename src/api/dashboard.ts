import { z } from "zod";
import { api } from "./client";

const optText = z.string().nullable().catch(null);

const metaSchema = z.object({
  mode: z.string().catch("api_only"),
  keepalive_status: z.string().catch("healthy"),
  last_keepalive_at: optText,
  quality: optText,
  messaging_limit: optText,
  situacao: optText,
  problemas: z
    .array(
      z.object({
        codigo: z.number().catch(0),
        titulo: z.string().catch(""),
        acao: z.string().catch(""),
        gravidade: z.string().catch(""),
      })
    )
    .catch([]),
  checked_at: optText,
});

const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: optText,
  status: z.string().catch("disconnected"),
  connected: z.boolean(),
  provider: optText,
  owner: optText,
  team: z.array(z.string()).catch([]),
  ai_assistant: optText,
  pending: z.number().catch(0),
  unassigned: z.number().catch(0),
  last_message_at: optText,
  sync_error: z.boolean().catch(false),
  number_changed_at: optText,
  previous_number: optText,
  meta: metaSchema.nullable().catch(null),
});

const schema = z.object({
  data: z.object({
    as_of: z.string(),
    queue: z.object({
      unassigned: z.number(),
      oldest_wait_seconds: z.number().nullable(),
      pending: z.number(),
      in_attendance: z.number(),
      on_hold: z.number(),
      with_ai: z.number(),
    }),
    operators: z.array(
      z.object({
        user_id: z.string(),
        name: z.string(),
        online: z.boolean(),
        systems: z.array(z.string()),
        active: z.number(),
        in_attendance: z.number(),
        on_hold: z.number(),
        limit: z.number().nullable(),
        // Folha do operador (13/11). Servidor sem a mudança: nulos.
        oldest_active_seconds: z.number().nullable().catch(null),
        last_seen_at: optText,
      })
    ),
    channels: z.object({
      connected: z.number(),
      disconnected: z.array(
        z.object({ id: z.string(), name: z.string(), number: z.string().nullable() })
      ),
      // Detalhe de cada canal (12/11). Opcional: servidor ainda sem a mudança manda só a lista acima.
      items: z.array(channelSchema).optional().catch(undefined),
    }),
  }),
});

export type LiveDashboard = z.infer<typeof schema>["data"];
export type LiveOperator = LiveDashboard["operators"][number];
export type LiveChannel = z.infer<typeof channelSchema>;

export const dashboardApi = {
  live: async (): Promise<LiveDashboard> => (await api.get("/dashboard/live", schema)).data,
};
