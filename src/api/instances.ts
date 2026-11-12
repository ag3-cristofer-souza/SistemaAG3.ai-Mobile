import { z } from "zod";
import { api } from "./client";

/**
 * Canais de WhatsApp da empresa, só para dar nome à instância de cada conversa. O servidor já filtra: o operador recebe
 * as compartilhadas e as dele, sem credenciais. `display_name` é o nome que o painel mostra em toda tela.
 */
const instanceSchema = z.object({
  id: z.string(),
  display_name: z.string().nullish(),
  name: z.string().nullish(),
  instance_name: z.string().nullish(),
  number: z.string().nullish(),
  connected_phone: z.string().nullish(),
  display_phone_number: z.string().nullish(),
});

const listSchema = z.object({ data: z.array(instanceSchema) });

export type Instance = z.infer<typeof instanceSchema>;

export const instancesApi = {
  list: async (): Promise<Instance[]> => (await api.get("/instances", listSchema)).data,
};
