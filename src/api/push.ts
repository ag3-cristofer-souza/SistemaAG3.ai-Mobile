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

export const pushApi = {
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
