import { z } from "zod";
import { api } from "./client";

const namedSchema = z.object({ id: z.string(), name: z.string().nullish() });

const itemSchema = z.object({
  kind: z.enum(["event", "task"]),
  id: z.string(),
  title: z
    .string()
    .nullish()
    .transform((value) => value || "Sem título"),
  description: z.string().nullable().catch(null),
  start_at: z.string(),
  end_at: z.string(),
  status: z.string().catch(""),
  done: z.boolean().catch(false),
  overdue: z.boolean().catch(false),
  attendance: z.string().nullable().catch(null),
  type: namedSchema.extend({ color: z.string().nullish() }).nullable().catch(null),
  owner: namedSchema.nullable().catch(null),
  lead: namedSchema.nullable().catch(null),
  meet_link: z.string().nullable().catch(null),
});

const typeSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullish(),
  applies_to: z.string().catch("both"),
});
const leadOptionSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  phone: z.string().nullish(),
});

const list = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });

export type CalendarItem = z.infer<typeof itemSchema>;
export type ItemKind = CalendarItem["kind"];
export type AgendaType = z.infer<typeof typeSchema>;
export type LeadOption = z.infer<typeof leadOptionSchema>;

export interface ItemFields {
  title: string;
  start_at: string;
  end_at: string;
  description: string;
  lead_id: string | null;
  type_id: string | null;
  assigned_to?: string | null;
}

const minutesBetween = (start: string, end: string) =>
  Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);

/** Tarefa guarda início e duração; evento, início e fim. */
const taskBody = ({ start_at, end_at, ...rest }: ItemFields) => ({
  ...rest,
  due_date: start_at,
  duration_min: minutesBetween(start_at, end_at),
});

export const calendarApi = {
  feed: async (from: string, to: string, owner?: string): Promise<CalendarItem[]> =>
    (await api.get("/calendar/feed", list(itemSchema), { from, to, owner })).data,
  /** Tarefas atrasadas de qualquer data. O servidor ignora a janela, mas ela continua obrigatória. */
  overdue: async (from: string, to: string, owner?: string): Promise<CalendarItem[]> =>
    (await api.get("/calendar/feed", list(itemSchema), { from, to, owner, overdue: true })).data,
  item: async (kind: ItemKind, id: string): Promise<CalendarItem> =>
    (await api.get(`/calendar/items/${kind}/${id}`, z.object({ data: itemSchema }))).data,
  types: async (): Promise<AgendaType[]> => (await api.get("/agenda-types", list(typeSchema))).data,
  searchLeads: async (search: string): Promise<LeadOption[]> =>
    (
      await api.get("/leads", list(leadOptionSchema), {
        search,
        limit: 20,
        select: "board",
        enrich: "false",
      })
    ).data,
  create: (kind: ItemKind, fields: ItemFields) =>
    kind === "event"
      ? api.post("/events", z.unknown(), fields)
      : api.post("/tasks", z.unknown(), { ...taskBody(fields), status: "todo" }),
  update: (kind: ItemKind, id: string, fields: ItemFields) =>
    kind === "event"
      ? api.patch(`/events/${id}`, z.unknown(), fields)
      : api.put(`/tasks/${id}`, z.unknown(), taskBody(fields)),
  remove: (kind: ItemKind, id: string) =>
    api.delete(kind === "event" ? `/events/${id}` : `/tasks/${id}`, z.unknown()),
  completeTask: (id: string) => api.post(`/tasks/${id}/complete`, z.unknown()),
  setAttendance: (id: string, attendance: "done" | "no_show") =>
    api.patch(`/calendar/items/event/${id}`, z.unknown(), { attendance }),
};
