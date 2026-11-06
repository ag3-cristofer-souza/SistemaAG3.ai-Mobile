import type { Conversation, ConversationCounts, ConversationFilters } from "@/api/conversations";
import { isManagerRole, type AppRole } from "@/lib/roles";

export interface ConversationTab {
  key: string;
  label: string;
  countKey: keyof ConversationCounts;
  filters: ConversationFilters;
}

/**
 * Mesmas abas e filtros do painel (`useConversationPanel.ts`). Só organizam a tela: o que o operador pode ver quem decide
 * é o servidor. Grupo não é atribuído a um operador, então a aba não filtra por dono.
 */
export function tabsFor(role: AppRole, userId: string): ConversationTab[] {
  const manager = isManagerRole(role);
  const own = manager ? {} : { assigned_agent_id: userId };
  const tabs: ConversationTab[] = [
    {
      key: "pending",
      label: "Pendentes",
      countKey: "pending",
      filters: { status: "pending", is_group: false, ...own },
    },
    {
      key: "mine",
      label: "Minhas",
      countKey: "mine",
      filters: { status: "in_attendance,on_hold", is_group: false, assigned_agent_id: userId },
    },
    {
      key: "on_hold",
      label: "Em espera",
      countKey: "on_hold",
      filters: { status: "on_hold", is_group: false, assigned_agent_id: userId },
    },
    {
      key: "groups",
      label: "Grupos",
      countKey: "groups",
      filters: { status: "pending,in_attendance,on_hold", is_group: true },
    },
    {
      key: "finished",
      label: "Finalizadas",
      countKey: "finished",
      filters: { status: "finished", is_group: false, ...own },
    },
  ];
  if (!manager) return tabs;
  return [
    ...tabs,
    {
      key: "ia",
      label: "Com a IA",
      countKey: "ia",
      filters: { status: "qualification_in_progress", is_group: false },
    },
    {
      key: "all",
      label: "Todas",
      countKey: "all",
      filters: {
        status: "qualification_in_progress,pending,in_attendance,on_hold",
        is_group: false,
      },
    },
  ];
}

export const STATUS_LABEL: Record<string, string> = {
  qualification_in_progress: "Com a IA",
  pending: "Pendente",
  in_attendance: "Em atendimento",
  on_hold: "Em espera",
  finished: "Finalizada",
};

export const conversationName = (conversation: Conversation) =>
  conversation.participant_name ||
  conversation.lead_name ||
  conversation.participant_phone ||
  "Sem nome";
