import type { Conversation } from "@/api/conversations";

export interface ChatActionsAvailable {
  hold: boolean;
  resume: boolean;
  transfer: boolean;
  returnToQueue: boolean;
  finish: boolean;
  returnToAi: boolean;
}

/** Mesmas regras do painel. Grupo não é atribuído a ninguém nem segue o fluxo de finalização. */
export function availableActions(conversation: Conversation): ChatActionsAvailable {
  const individual = !conversation.is_group;
  const open = conversation.status !== "finished";
  return {
    hold: individual && conversation.status === "in_attendance",
    resume: individual && conversation.status === "on_hold",
    transfer: individual && open,
    returnToQueue: individual && open && Boolean(conversation.assigned_agent_id),
    finish: individual && open,
    returnToAi: individual && open && conversation.status !== "qualification_in_progress",
  };
}

/** Antes de responder, é preciso assumir: pendente sem aceite ou com a IA. */
export const requiresAssume = (conversation: Conversation): boolean =>
  !conversation.is_group &&
  (conversation.status === "pending" || conversation.status === "qualification_in_progress");
