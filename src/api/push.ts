import { z } from "zod";
import { ApiError, api } from "./client";

/** Configuração pública do Firebase. Quem cadastra e guarda é o Django; o app não tem nenhuma chave própria. */
export interface PushConfig {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

const schema = z.object({
  data: z.object({
    enabled: z.boolean(),
    api_key: z.string().optional(),
    project_id: z.string().optional(),
    messaging_sender_id: z.string().optional(),
    app_id: z.string().optional(),
    vapid_key: z.string().optional(),
  }),
});

const deviceSchema = z.object({ data: z.object({ id: z.string() }) });

const preferencesSchema = z.object({
  new_message: z.boolean(),
  assignment: z.boolean(),
  agenda: z.boolean(),
  manager_alerts: z.boolean(),
  queue_alert_minutes: z.number(),
});
const preferencesResponse = z.object({ data: preferencesSchema });

/** O que a pessoa quer receber, em todos os aparelhos dela. Quem decide o que enviar é o Django. */
export type PushPreferences = z.infer<typeof preferencesSchema>;

export const pushApi = {
  preferences: async (): Promise<PushPreferences> =>
    (await api.get("/push/preferences", preferencesResponse)).data,

  updatePreferences: async (fields: Partial<PushPreferences>): Promise<PushPreferences> =>
    (await api.patch("/push/preferences", preferencesResponse, fields)).data,

  /** Registra o token deste aparelho no Django, que passa a decidir o que enviar. */
  registerDevice: async (token: string, platform: string): Promise<string> =>
    (await api.post("/push/devices", deviceSchema, { token, platform })).data.id,

  /** `null` enquanto as notificações não estiverem configuradas no Django. */
  config: async (): Promise<PushConfig | null> => {
    let data: z.infer<typeof schema>["data"];
    try {
      ({ data } = await api.get("/push/config", schema));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
    const { enabled, api_key, project_id, messaging_sender_id, app_id, vapid_key } = data;
    if (!enabled || !api_key || !project_id || !messaging_sender_id || !app_id || !vapid_key) {
      return null;
    }
    return {
      apiKey: api_key,
      projectId: project_id,
      messagingSenderId: messaging_sender_id,
      appId: app_id,
      vapidKey: vapid_key,
    };
  },
};
