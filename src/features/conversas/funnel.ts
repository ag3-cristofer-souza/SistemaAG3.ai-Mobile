import type { LeadCard, Pipeline, Stage } from "@/api/crm";

/**
 * Etapas do funil. Mesmas regras do board do painel (`lib/boards/board-stages.ts`), para o app e o painel listarem as mesmas
 * colunas: funil padrão junta as etapas do sistema, as criadas e as vindas de integrações; funil personalizado mostra só as dele.
 */
const HIDDEN = new Set(["service_panel", "new_panel"]);

const BASE_STAGES: Stage[] = [
  { key: "ai_handling", label: "Com a IA" },
  { key: "pending", label: "Pendente" },
  { key: "in_progress", label: "Em Atendimento" },
  { key: "interested", label: "Interessado" },
  { key: "not_interested", label: "Não Interessado" },
  { key: "cold", label: "Frio" },
  { key: "converted", label: "Convertido" },
  { key: "lost", label: "Perdido" },
  { key: "callback_requested", label: "Retorno Solicitado" },
  { key: "no_answer", label: "Não Atendeu" },
];

export function isCustomPipeline(pipelineId: string | null | undefined, pipelines: Pipeline[]) {
  const standard = pipelines.find((item) => item.is_default) ?? pipelines[0];
  return Boolean(pipelineId && standard && pipelineId !== standard.id);
}

export function buildStages(stages: Stage[], custom: boolean, dynamicStatuses: string[]): Stage[] {
  const ordered = [...stages]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .filter((stage) => !HIDDEN.has(stage.key));
  if (custom) return ordered;

  const byKey = new Map(ordered.map((stage) => [stage.key, stage]));
  const base = BASE_STAGES.map((stage) => byKey.get(stage.key) ?? stage);
  const isBase = new Set(BASE_STAGES.map((stage) => stage.key));
  const columns = [...base, ...ordered.filter((stage) => !isBase.has(stage.key))];
  const known = new Set(columns.map((stage) => stage.key));
  const dynamic = dynamicStatuses
    .filter((status) => !known.has(status) && !HIDDEN.has(status))
    .map((status) => ({ key: status, label: status }));
  const pending = columns.findIndex((stage) => stage.key === "pending");
  columns.splice(pending + 1, 0, ...dynamic);
  return columns;
}

/** A etapa atual precisa aparecer na lista, mesmo que tenha saído do funil. */
export function withCurrentStage(stages: Stage[], current: string | null | undefined): Stage[] {
  if (!current || stages.some((stage) => stage.key === current)) return stages;
  return [...stages, { key: current, label: current }];
}

export const stageLabel = (stages: Stage[], key: string | null | undefined) =>
  stages.find((stage) => stage.key === key)?.label ?? key ?? "Sem etapa";

/**
 * Qual card a conversa mostra. A mesma ordem do painel (`cardFoco.ts`): o aberto dele, o aberto sem dono, o aberto mais recente.
 * Sem nenhum aberto, o mais recente: quem acabou de converter continua vendo o card e pode reabrir.
 */
export function focusCard(cards: LeadCard[], userId: string): LeadCard | null {
  const open = cards.filter((card) => !card.closed_at);
  return (
    open.find((card) => card.assigned_to === userId) ??
    open.find((card) => !card.assigned_to) ??
    open[0] ??
    cards[0] ??
    null
  );
}

export type CardAccess = "move" | "assume" | "other";

/** Só organiza a tela: quem barra é o servidor. Card sem dono precisa ser assumido antes de mover, como no painel. */
export function cardAccess(card: LeadCard, userId: string, manager: boolean): CardAccess {
  if (!card.assigned_to) return "assume";
  return card.assigned_to === userId || manager ? "move" : "other";
}

const HISTORY_LABEL: Record<string, string> = {
  card_criado: "Card criado",
  card_etapa: "Etapa alterada",
  card_funil: "Funil alterado",
  card_responsavel: "Responsável alterado",
  card_valor: "Valor alterado",
  card_excluido: "Card excluído",
  atendimento_iniciado: "Atendimento iniciado",
  atendimento_status: "Status do atendimento",
  atendimento_atribuido: "Atendimento atribuído",
  atendimento_transferido: "Atendimento transferido",
  atendimento_fila: "Voltou para a fila",
  ligacao: "Ligação",
};

export const historyLabel = (kind: string) => HISTORY_LABEL[kind] ?? "Atualização";

export function historyDetail(item: { from_label: string | null; to_label: string | null }) {
  if (item.from_label && item.to_label) return `${item.from_label} → ${item.to_label}`;
  return item.to_label ?? item.from_label ?? "";
}
