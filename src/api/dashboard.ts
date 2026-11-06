import { z } from "zod";
import { api } from "./client";

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
      })
    ),
    channels: z.object({
      connected: z.number(),
      disconnected: z.array(
        z.object({ id: z.string(), name: z.string(), number: z.string().nullable() })
      ),
    }),
  }),
});

export type LiveDashboard = z.infer<typeof schema>["data"];
export type LiveOperator = LiveDashboard["operators"][number];

export const dashboardApi = {
  live: async (): Promise<LiveDashboard> => (await api.get("/dashboard/live", schema)).data,
};
