import {
  Headset,
  Hourglass,
  MessageCircleWarning,
  MessagesSquare,
  Percent,
  Send,
  Target,
  Trophy,
} from "lucide-react";
import type { Overview } from "@/api/metrics";
import { formatDuration } from "@/lib/format";
import { StatGrid, StatTile } from "./charts";
import { formatInt, formatPercent } from "./period";

/**
 * Os indicadores de uma pessoa no período: os de "Meus números" e os da folha do operador são os mesmos. `userId` acha a
 * linha dela em `operators` (mensagens que mandou e conversas em que escreveu, MOB-11).
 */
export function PeriodResults({
  overview,
  label,
  userId,
}: {
  overview: Overview;
  label: string;
  userId: string;
}) {
  const own = overview.operators.find((row) => row.user_id === userId);
  return (
    <StatGrid label={label}>
      <StatTile
        icon={Send}
        tone="primary"
        label="Mensagens enviadas"
        value={formatInt(own?.messages ?? 0)}
      />
      <StatTile
        icon={Headset}
        tone="success"
        label="Conversas atendidas"
        value={formatInt(own?.conversations ?? 0)}
      />
      <StatTile
        icon={MessagesSquare}
        tone="primary"
        label="Atendimentos novos"
        value={formatInt(overview.attendance?.new_attendances ?? 0)}
      />
      <StatTile
        icon={Hourglass}
        tone="warning"
        label="Espera média"
        value={formatDuration(overview.attendance?.avg_waiting_time_seconds ?? 0)}
      />
      <StatTile
        icon={Trophy}
        tone="success"
        label="Convertidos"
        value={formatInt(overview.commercial.executiveSummary.conversionsInPeriod)}
      />
      <StatTile
        icon={Percent}
        tone="violet"
        label="Taxa de conversão"
        value={formatPercent(overview.commercial.executiveSummary.conversionRatePercent)}
      />
      <StatTile
        icon={MessageCircleWarning}
        tone="warning"
        label="A responder"
        value={formatInt(overview.zap.summary.aResponder)}
      />
      <StatTile
        icon={Target}
        tone="success"
        label="Efetividade"
        value={formatPercent(overview.zap.summary.efetividade)}
      />
    </StatGrid>
  );
}
