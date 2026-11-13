import {
  Hourglass,
  MessageCircleWarning,
  MessagesSquare,
  Percent,
  Target,
  Trophy,
} from "lucide-react";
import type { Overview } from "@/api/metrics";
import { formatDuration } from "@/lib/format";
import { StatGrid, StatTile } from "./charts";
import { formatInt, formatPercent } from "./period";

/** Os indicadores de uma pessoa no período: os de "Meus números" e os da folha do operador são os mesmos. */
export function PeriodResults({ overview, label }: { overview: Overview; label: string }) {
  return (
    <StatGrid label={label}>
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
