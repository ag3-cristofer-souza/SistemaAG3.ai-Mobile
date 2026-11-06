import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { dashboardApi, type LiveOperator } from "@/api/dashboard";
import { formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { realtime, useRealtimeState } from "@/realtime";
import { Button } from "@/ui/button";
import { EmptyState, FullScreenLoader } from "@/ui/feedback";

const QUERY_KEY = ["dashboard-live"];
const MIN_REFRESH_MS = 15_000;
const POLL_ONLINE_MS = 60_000;
const POLL_OFFLINE_MS = 30_000;

/** Evento de conversa vira nova busca, no máximo a cada 15 s. Com a tela fechada, não busca. */
function useLiveDashboard() {
  const queryClient = useQueryClient();
  const state = useRealtimeState();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: dashboardApi.live,
    staleTime: 0,
    // Operador entrar ou canal cair não geram evento de conversa, então a consulta periódica continua valendo.
    refetchInterval: state === "online" ? POLL_ONLINE_MS : POLL_OFFLINE_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = realtime.on("conversations", () => {
      if (timer || document.visibilityState === "hidden") return;
      const updatedAt = queryClient.getQueryState(QUERY_KEY)?.dataUpdatedAt ?? 0;
      const wait = Math.max(0, MIN_REFRESH_MS - (Date.now() - updatedAt));
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, wait);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);

  return query;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const SYSTEM_LABEL: Record<string, string> = { mobile: "App", painel: "Painel" };

function OperatorRow({ operator }: { operator: LiveOperator }) {
  const { active, limit } = operator;
  const atLimit = limit !== null && limit > 0 && active >= limit;
  const percent = limit ? Math.min(100, (active / limit) * 100) : 0;
  const presence = operator.online
    ? operator.systems.map((system) => SYSTEM_LABEL[system] ?? system).join(" e ")
    : "Offline";
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{operator.name}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              operator.online ? "bg-success" : "bg-muted-foreground/40"
            )}
          />
          {presence}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {limit !== null ? `${active} de ${limit} na fila` : `${active} na fila`} ·{" "}
        {operator.in_attendance} em atendimento · {operator.on_hold} em espera
        {atLimit && <span className="font-medium text-foreground"> · No limite</span>}
      </p>
      {limit !== null && limit > 0 && (
        <div
          role="meter"
          aria-label={`Fila de ${operator.name}`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(active, limit)}
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full", atLimit ? "bg-warning" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </li>
  );
}

export function AgoraPage() {
  const query = useLiveDashboard();
  const now = useNow(5_000);

  if (query.isPending) return <FullScreenLoader />;
  if (!query.data) {
    return (
      <EmptyState icon={CloudOff} title="Não foi possível carregar os números">
        <p>{query.error instanceof ApiError ? query.error.detail : "Tente de novo."}</p>
        <Button block className="mt-4" onClick={() => void query.refetch()}>
          Tentar de novo
        </Button>
      </EmptyState>
    );
  }

  const { queue, operators, channels } = query.data;
  const age = Math.max(0, (now - query.dataUpdatedAt) / 1000);
  const waiting = queue.oldest_wait_seconds === null ? null : queue.oldest_wait_seconds + age;
  const assignedWaiting = queue.pending - queue.unassigned;
  const online = operators.filter((operator) => operator.online).length;
  const ordered = [...operators].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "pt-BR")
  );

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Fila sem dono</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{queue.unassigned}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {waiting === null ? "Ninguém esperando" : `Maior espera: ${formatDuration(waiting)}`}
          {assignedWaiting > 0 && ` · ${assignedWaiting} aguardando aceite`}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label="Atendimentos">
        <Tile label="Em atendimento" value={queue.in_attendance} />
        <Tile label="Em espera" value={queue.on_hold} />
        <Tile label="Com a IA" value={queue.with_ai} />
      </section>

      <section className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-medium">
          Canais: {channels.connected} conectado{channels.connected === 1 ? "" : "s"}
        </h2>
        {channels.disconnected.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum canal desconectado.</p>
        ) : (
          <ul className="divide-y">
            {channels.disconnected.map((channel) => (
              <li key={channel.id} className="flex items-center gap-3 px-4 py-3">
                <Unplug className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                <span className="shrink-0 text-xs font-medium">Desconectado</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-medium">
          Equipe: {online} online de {operators.length}
        </h2>
        <ul className="divide-y">
          {ordered.map((operator) => (
            <OperatorRow key={operator.user_id} operator={operator} />
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-muted-foreground" role="status">
        {query.isError
          ? `Sem atualização desde ${formatTime(new Date(query.dataUpdatedAt).toISOString())}`
          : `Atualizado há ${age < 60 ? `${Math.floor(age)} s` : formatDuration(age)}`}
      </p>
    </div>
  );
}
