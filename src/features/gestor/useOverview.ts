import { useQuery } from "@tanstack/react-query";
import { metricsApi } from "@/api/metrics";
import { instantRange, type PeriodKey } from "./period";

export const STALE_MS = 60_000;

/** Comercial, atendimento e WhatsApp na mesma chamada do painel, que o servidor guarda em cache. */
export function useOverview(period: PeriodKey, agentId?: string) {
  return useQuery({
    queryKey: agentId ? ["metrics", "overview", period, agentId] : ["metrics", "overview", period],
    queryFn: () => metricsApi.overview(instantRange(period), agentId),
    staleTime: STALE_MS,
  });
}
