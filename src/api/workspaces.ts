import { z } from "zod";
import { api } from "./client";

const schema = z.object({
  data: z.array(
    z.object({
      company_id: z.string(),
      company_name: z.string().nullable(),
      is_primary: z.boolean().optional(),
    })
  ),
});

export type Workspace = z.infer<typeof schema>["data"][number];

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => (await api.get("/users/workspaces", schema)).data,
};
