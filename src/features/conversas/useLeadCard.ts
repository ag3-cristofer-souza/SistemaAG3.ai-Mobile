import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { crmApi } from "@/api/crm";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { isManagerRole } from "@/lib/roles";
import { buildStages, cardAccess, focusCard, isCustomPipeline, withCurrentStage } from "./funnel";

/** O card do lead que a conversa mostra, as etapas do funil dele e as ações. Funis mudam pouco: cache de 5 minutos. */
export function useLeadCard(leadId: string | null | undefined) {
  const user = useCurrentUser();
  const { role } = useWorkspace();
  const queryClient = useQueryClient();
  const enabled = Boolean(leadId);

  const cards = useQuery({
    queryKey: ["lead-cards", leadId],
    queryFn: () => crmApi.cards(leadId!),
    enabled,
    staleTime: 0,
  });
  const card = useMemo(() => focusCard(cards.data ?? [], user.id), [cards.data, user.id]);

  const pipelines = useQuery({
    queryKey: ["pipelines"],
    queryFn: crmApi.pipelines,
    enabled,
    staleTime: 5 * 60_000,
  });
  const standard = pipelines.data?.find((item) => item.is_default) ?? pipelines.data?.[0];
  const pipelineId = card?.pipeline_id ?? standard?.id;
  const stagesQuery = useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    queryFn: () => crmApi.stages(pipelineId!),
    enabled: enabled && Boolean(pipelineId),
    staleTime: 5 * 60_000,
  });
  const dynamic = useQuery({
    queryKey: ["dynamic-statuses"],
    queryFn: crmApi.dynamicStatuses,
    enabled,
    staleTime: 5 * 60_000,
  });

  const stages = useMemo(
    () =>
      withCurrentStage(
        buildStages(
          stagesQuery.data ?? [],
          isCustomPipeline(pipelineId, pipelines.data ?? []),
          dynamic.data ?? []
        ),
        card?.status
      ),
    [stagesQuery.data, pipelineId, pipelines.data, dynamic.data, card?.status]
  );

  // Devolve a promessa: a ação só termina quando o card novo chegou, e a tela não pisca a etapa antiga.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lead-cards", leadId] }),
      queryClient.invalidateQueries({ queryKey: ["lead-history", leadId] }),
    ]);

  const move = useMutation({
    mutationFn: (status: string) => crmApi.moveCard(card!.id, status),
    onSuccess: refresh,
  });
  const assume = useMutation({
    mutationFn: () => crmApi.assumeCard(card!.id),
    onSuccess: refresh,
  });
  const addNote = useMutation({
    mutationFn: (content: string) => crmApi.addNote(leadId!, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
    },
  });

  return {
    card,
    stages,
    access: card ? cardAccess(card, user.id, isManagerRole(role)) : null,
    loading: cards.isPending && enabled,
    move,
    assume,
    addNote,
  };
}
