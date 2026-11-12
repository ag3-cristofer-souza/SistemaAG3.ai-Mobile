import { z } from "zod";
import { api } from "./client";

/** Campos opcionais: a API omite ou anula o que a conversa não tem. O acesso é decidido no servidor. */
const conversationSchema = z.object({
  id: z.string(),
  status: z.string().nullish(),
  participant_name: z.string().nullish(),
  participant_phone: z.string().nullish(),
  participant_photo_storage_url: z.string().nullish(),
  is_group: z.boolean().nullish(),
  connected_instance_id: z.string().nullish(),
  connected_phone: z.string().nullish(),
  assigned_agent_id: z.string().nullish(),
  agent_name: z.string().nullish(),
  lead_id: z.string().nullish(),
  lead_name: z.string().nullish(),
  unread_count: z.number().nullish(),
  last_message: z.string().nullish(),
  last_message_at: z.string().nullish(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversation_id: z.string().nullish(),
  direction: z.string().nullish(),
  body: z.string().nullish(),
  payload: z.unknown().optional(),
  message_type: z.string().nullish(),
  media_url: z.string().nullish(),
  media_mime_type: z.string().nullish(),
  media_caption: z.string().nullish(),
  z_api_message_id: z.string().nullish(),
  sender_type: z.string().nullish(),
  sender_name: z.string().nullish(),
  delivery_status: z.string().nullish(),
  is_deleted: z.boolean().nullish(),
  transcription: z.string().nullish(),
  created_at: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

const listSchema = z.object({ data: z.array(conversationSchema), page: z.number() });
const detailSchema = z.object({ data: conversationSchema });
const messagesSchema = z.object({ data: z.array(messageSchema), page: z.number() });
const countsSchema = z.object({
  data: z.object({
    ia: z.number(),
    pending: z.number(),
    groups: z.number(),
    all: z.number(),
    mine: z.number(),
    on_hold: z.number(),
    finished: z.number(),
  }),
});

const sentSchema = z.object({
  data: messageSchema,
  provider_message_id: z.string().nullish(),
  duplicate: z.boolean().optional(),
});
const uploadSchema = z.object({ data: z.object({ url: z.string() }) });
const noteSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string().nullable(),
});
const notesSchema = z.object({ data: z.array(noteSchema) });
const createdNoteSchema = z.object({ data: noteSchema });
const agentLimitSchema = z.object({
  data: z.object({
    limit: z.number().nullable(),
    active_count: z.number(),
    is_at_limit: z.boolean(),
  }),
});
const rosterSchema = z.object({
  data: z.array(z.object({ id: z.string(), full_name: z.string().nullable() })),
});

export type Note = z.infer<typeof noteSchema>;
export type RosterMember = z.infer<typeof rosterSchema>["data"][number];
export type MessageKind = "text" | "image" | "audio" | "video" | "document";

export interface SendBody {
  message: string;
  media_url?: string;
  message_type: MessageKind;
  quoted_message_id?: string;
  client_message_id: string;
}

export type ConversationCounts = z.infer<typeof countsSchema>["data"];
export type MessagesPage = z.infer<typeof messagesSchema>;

export interface ConversationFilters {
  status?: string;
  assigned_agent_id?: string;
  is_group?: boolean;
  search?: string;
}

export const CONVERSATIONS_PAGE_SIZE = 30;
export const MESSAGES_PAGE_SIZE = 50;

export const conversationsApi = {
  list: (filters: ConversationFilters, page: number) =>
    api.get("/conversations", listSchema, { ...filters, page, limit: CONVERSATIONS_PAGE_SIZE }),
  counts: async (): Promise<ConversationCounts> =>
    (await api.get("/conversations/counts", countsSchema)).data,
  get: async (id: string): Promise<Conversation> =>
    (await api.get(`/conversations/${id}`, detailSchema)).data,
  messages: (id: string, page: number) =>
    api.get(`/conversations/${id}/messages`, messagesSchema, {
      page,
      limit: MESSAGES_PAGE_SIZE,
      sort_order: "desc",
    }),
  send: async (id: string, body: SendBody): Promise<Message> =>
    (await api.post(`/conversations/${id}/send-message`, sentSchema, body)).data,
  upload: async (id: string, file: Blob, fileName: string, mimeType: string): Promise<string> => {
    const form = new FormData();
    form.append("file", new File([file], fileName, { type: mimeType }));
    return (await api.upload(`/conversations/${id}/media`, uploadSchema, form)).data.url;
  },
  patchMessage: (messageId: string, fields: Record<string, unknown>) =>
    api.patch(`/conversations/messages/${messageId}`, z.unknown(), fields),
  agentLimit: async () => (await api.get("/conversations/agent-limit", agentLimitSchema)).data,
  assign: (id: string, agentId: string) =>
    api.post(`/conversations/${id}/assign`, z.unknown(), {
      agent_id: agentId,
      assignment_type: "from_queue",
    }),
  transfer: (id: string, toAgentId: string, note: string) =>
    api.post(`/conversations/${id}/transfer`, z.unknown(), {
      to_agent_id: toAgentId,
      transfer_note: note,
    }),
  hold: (id: string) => api.post(`/conversations/${id}/hold`, z.unknown()),
  resume: (id: string) => api.post(`/conversations/${id}/resume`, z.unknown()),
  finish: (id: string) => api.post(`/conversations/${id}/finish`, z.unknown()),
  returnToQueue: (id: string) => api.post(`/conversations/${id}/return-to-queue`, z.unknown()),
  returnToAi: (id: string) => api.post(`/conversations/${id}/return-to-ai`, z.unknown()),
  notes: async (id: string): Promise<Note[]> =>
    (await api.get(`/conversations/${id}/notes`, notesSchema)).data,
  addNote: async (id: string, content: string): Promise<Note> =>
    (await api.post(`/conversations/${id}/notes`, createdNoteSchema, { content })).data,
  roster: async (): Promise<RosterMember[]> =>
    (await api.get("/users/workspace-roster", rosterSchema)).data,
  /** Como o painel ao abrir o chat. Falhar aqui não impede a leitura. */
  markRead: async (id: string): Promise<void> => {
    await Promise.allSettled([
      api.post(`/conversations/${id}/messages/mark-read`, z.unknown()),
      api.post(`/conversations/${id}/reset-unread`, z.unknown()),
    ]);
  },
};
