import { useQuery } from "@tanstack/react-query";
import {
  Headset,
  Hourglass,
  Inbox,
  MessageCircleWarning,
  MessagesSquare,
  PauseCircle,
  Percent,
  Target,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { conversationsApi } from "@/api/conversations";
import { formatDuration } from "@/lib/format";
import { StatGrid, StatTile, Loading, SectionError } from "./charts";
import { PeriodPicker } from "./PeriodPicker";
import { useOverview } from "./useOverview";
import { formatInt, formatPercent, type PeriodKey } from "./period";

/**
 * Indicadores do operador, para ajudar no dia a dia. O servidor limita tudo aos números dele: `scope()` ignora qualquer filtro
 * de operador e usa o usuário logado, e os contadores de conversa no app só contam as dele.
 */
export function MeusNumerosPage() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const overview = useOverview(period);
  const counts = useQuery({ queryKey: ["conversation-counts"], queryFn: conversationsApi.counts });
  const limit = useQuery({
    queryKey: ["agent-limit"],
    queryFn: conversationsApi.agentLimit,
    staleTime: 30_000,
  });
  const queue = limit.data;

  return (
    <div className="space-y-4 p-4">
      <h2 className="px-1 text-sm font-semibold">Agora</h2>
      <StatGrid label="Sua fila agora">
        <StatTile
          icon={Inbox}
          tone="primary"
          label="Na sua fila"
          value={formatInt(queue?.active_count ?? counts.data?.pending ?? 0)}
          hint={queue?.limit ? `Limite: ${formatInt(queue.limit)}` : undefined}
        />
        <StatTile
          icon={Headset}
          tone="success"
          label="Em atendimento"
          // A aba Minhas soma as em espera, que têm indicador próprio ao lado.
          value={formatInt(Math.max((counts.data?.mine ?? 0) - (counts.data?.on_hold ?? 0), 0))}
        />
        <StatTile
          icon={PauseCircle}
          tone="warning"
          label="Em espera"
          value={formatInt(counts.data?.on_hold ?? 0)}
        />
        <StatTile
          icon={UsersRound}
          tone="violet"
          label="Grupos"
          value={formatInt(counts.data?.groups ?? 0)}
        />
      </StatGrid>
      <h2 className="px-1 pt-2 text-sm font-semibold">No período</h2>
      <PeriodPicker value={period} onChange={setPeriod} />
      {overview.isPending && <Loading />}
      {!overview.isPending && !overview.data && (
        <SectionError error={overview.error} onRetry={() => void overview.refetch()} />
      )}
      {overview.data && (
        <StatGrid label="Seus resultados no período">
          <StatTile
            icon={MessagesSquare}
            tone="primary"
            label="Atendimentos novos"
            value={formatInt(overview.data.attendance?.new_attendances ?? 0)}
          />
          <StatTile
            icon={Hourglass}
            tone="warning"
            label="Espera média"
            value={formatDuration(overview.data.attendance?.avg_waiting_time_seconds ?? 0)}
          />
          <StatTile
            icon={Trophy}
            tone="success"
            label="Convertidos"
            value={formatInt(overview.data.commercial.executiveSummary.conversionsInPeriod)}
          />
          <StatTile
            icon={Percent}
            tone="violet"
            label="Taxa de conversão"
            value={formatPercent(overview.data.commercial.executiveSummary.conversionRatePercent)}
          />
          <StatTile
            icon={MessageCircleWarning}
            tone="warning"
            label="A responder"
            value={formatInt(overview.data.zap.summary.aResponder)}
          />
          <StatTile
            icon={Target}
            tone="success"
            label="Efetividade"
            value={formatPercent(overview.data.zap.summary.efetividade)}
          />
        </StatGrid>
      )}
    </div>
  );
}
