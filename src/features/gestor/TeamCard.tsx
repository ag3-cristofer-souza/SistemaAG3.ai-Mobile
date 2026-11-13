import {
  CalendarClock,
  ChevronRight,
  Hourglass,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type { LiveOperator } from "@/api/dashboard";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Sheet } from "@/ui/sheet";
import { Loading, SectionError } from "./charts";
import { AlertList, DetailLine } from "./detail";
import { formatInt, type PeriodKey } from "./period";
import { PeriodPicker } from "./PeriodPicker";
import { PeriodResults } from "./PeriodResults";
import {
  atLimit,
  oldestWait,
  operatorAlerts,
  presenceLabel,
  STALE_ACCEPT_S,
  systemsLabel,
} from "./team";
import { useOverview } from "./useOverview";

const DAY_S = 24 * 3600;

/** Equipe da empresa: carga de cada um agora; tocar na pessoa abre o detalhe com alertas e os números do período. */
export function TeamCard({
  operators,
  now,
  age,
}: {
  operators: LiveOperator[];
  now: number;
  /** Segundos desde a foto do servidor. */
  age: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const online = operators.filter((operator) => operator.online).length;
  const ordered = [...operators].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "pt-BR")
  );
  const open = operators.find((operator) => operator.user_id === openId) ?? null;

  return (
    <section className="surface overflow-hidden">
      <h2 className="px-4 pt-3.5 text-sm font-semibold">
        Equipe: {online} online de {operators.length}
      </h2>
      <ul className="mt-1 divide-y divide-border/70">
        {ordered.map((operator) => (
          <OperatorRow
            key={operator.user_id}
            operator={operator}
            age={age}
            onOpen={() => setOpenId(operator.user_id)}
          />
        ))}
      </ul>
      <Sheet open={open !== null} title="Detalhes do operador" onClose={() => setOpenId(null)}>
        {open && <OperatorDetail operator={open} now={now} age={age} />}
      </Sheet>
    </section>
  );
}

function OperatorAvatar({ operator, size }: { operator: LiveOperator; size: string }) {
  return (
    <span className="relative h-fit shrink-0">
      <Avatar name={operator.name} className={size} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card",
          operator.online ? "bg-success" : "bg-muted-foreground/40"
        )}
      />
    </span>
  );
}

function OperatorRow({
  operator,
  age,
  onOpen,
}: {
  operator: LiveOperator;
  age: number;
  onOpen: () => void;
}) {
  const { active, limit } = operator;
  const full = atLimit(operator);
  const percent = limit ? Math.min(100, (active / limit) * 100) : 0;
  const oldest = oldestWait(operator, age);
  return (
    // O botão cobre a linha por cima: o medidor fica fora dele e continua legível para leitor de tela.
    <li className="relative flex gap-3 px-4 py-3 active:bg-muted/60">
      <button
        type="button"
        aria-label={`Ver detalhes de ${operator.name}`}
        onClick={onOpen}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <OperatorAvatar operator={operator} size="size-10" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-semibold">{operator.name}</span>
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              operator.online ? "text-success" : "text-muted-foreground"
            )}
          >
            {operator.online ? systemsLabel(operator.systems) : "Offline"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {limit !== null
            ? `${active} de ${limit} aguardando aceite`
            : `${active} aguardando aceite`}{" "}
          · {operator.in_attendance} em atendimento · {operator.on_hold} em espera
          {full && <span className="font-semibold text-warning"> · No limite</span>}
        </p>
        {oldest !== null && oldest >= DAY_S && (
          <p
            className={cn(
              "text-xs font-medium",
              oldest >= STALE_ACCEPT_S ? "text-destructive" : "text-warning"
            )}
          >
            A mais antiga espera há {formatDuration(oldest)}
          </p>
        )}
        {limit !== null && limit > 0 && (
          <div
            role="meter"
            aria-label={`Fila de ${operator.name}`}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={Math.min(active, limit)}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight
        className="size-4 shrink-0 self-center text-muted-foreground"
        aria-hidden="true"
      />
    </li>
  );
}

function OperatorDetail({
  operator,
  now,
  age,
}: {
  operator: LiveOperator;
  now: number;
  age: number;
}) {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const overview = useOverview(period, operator.user_id);
  const alerts = operatorAlerts(operator, now, age);
  const oldest = oldestWait(operator, age);
  const lastSeen = operator.online
    ? "Agora"
    : operator.last_seen_at
      ? new Date(operator.last_seen_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Sem registro";

  return (
    <div className="space-y-4 px-4 pt-2">
      <div className="flex items-center gap-3">
        <OperatorAvatar operator={operator} size="size-12" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold leading-tight">{operator.name}</h3>
          <p
            className={cn(
              "text-sm",
              operator.online ? "font-medium text-success" : "text-muted-foreground"
            )}
          >
            {presenceLabel(operator, now)}
          </p>
        </div>
      </div>

      {alerts.length > 0 ? (
        <AlertList alerts={alerts} />
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm text-success">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Nenhum alerta para esta pessoa.
        </p>
      )}

      <section aria-label="Agora" className="space-y-2">
        <h4 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agora
        </h4>
        <div
          role="group"
          aria-label={`Fila de ${operator.name} agora`}
          className="grid grid-cols-3 gap-2"
        >
          <NowTile
            label="Aguardando aceite"
            value={operator.active}
            hint={operator.limit !== null ? `Limite: ${formatInt(operator.limit)}` : undefined}
          />
          <NowTile label="Em atendimento" value={operator.in_attendance} />
          <NowTile label="Em espera" value={operator.on_hold} />
        </div>
        <dl className="surface divide-y divide-border/70 overflow-hidden">
          <DetailLine
            icon={Hourglass}
            label="Mais antiga"
            value={oldest === null ? "Nenhuma aguardando" : `Aguarda há ${formatDuration(oldest)}`}
          />
          <DetailLine icon={CalendarClock} label="Último acesso" value={lastSeen} />
          <DetailLine
            icon={MonitorSmartphone}
            label="Conectado em"
            value={operator.online ? systemsLabel(operator.systems) : "Nenhum lugar agora"}
          />
        </dl>
      </section>

      <section aria-label="No período" className="space-y-2">
        <h4 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          No período
        </h4>
        <PeriodPicker value={period} onChange={setPeriod} />
        {overview.isPending && <Loading />}
        {!overview.isPending && !overview.data && (
          <SectionError error={overview.error} onRetry={() => void overview.refetch()} />
        )}
        {overview.data && (
          <PeriodResults
            overview={overview.data}
            label={`Resultados de ${operator.name} no período`}
          />
        )}
      </section>

      <p className="px-1 text-xs text-muted-foreground">
        Para transferir ou finalizar as conversas desta pessoa, use o painel.
      </p>
    </div>
  );
}

function NowTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-2xl font-bold tabular-nums tracking-tight">{formatInt(value)}</p>
      <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
