import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CloudOff, Headset, PauseCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { dashboardApi } from "@/api/dashboard";
import { formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { realtime, useRealtimeState } from "@/realtime";
import { Button } from "@/ui/button";
import { EmptyState, FullScreenLoader } from "@/ui/feedback";
import { ChannelsCard } from "./ChannelsCard";
import { TeamCard } from "./TeamCard";

const QUERY_KEY = ["dashboard-live"];
const MIN_REFRESH_MS = 15_000;
const POLL_ONLINE_MS = 60_000;
const POLL_OFFLINE_MS = 30_000;
/** Espera acima disto já não é fila do dia: é conversa esquecida. */
const STALE_QUEUE_S = 7 * 24 * 3600;

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

function Tile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="surface p-3">
      <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

/** Um dos dois números da fila: rótulo, valor grande e uma linha dizendo o que ele conta. */
function QueueBox({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone: string;
}) {
  return (
    <div role="group" aria-label={label} className="rounded-xl bg-card p-3.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums tracking-tight", tone)}>{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{caption}</p>
    </div>
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

  return (
    <div className="space-y-4 p-4">
      <section className="brand-soft rounded-2xl p-3 shadow-card" aria-label="Fila agora">
        <div className="grid grid-cols-2 gap-2.5">
          <QueueBox
            label="Fila sem dono"
            value={queue.unassigned}
            caption={
              waiting === null ? "Ninguém esperando" : `Maior espera: ${formatDuration(waiting)}`
            }
            tone={queue.unassigned > 0 ? "text-warning" : "text-success"}
          />
          <QueueBox
            label="Aguardando aceite"
            value={assignedWaiting}
            caption="Têm operador, falta aceitar"
            tone="text-primary"
          />
        </div>
        {waiting !== null && waiting > STALE_QUEUE_S && (
          <p className="mt-2.5 flex gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              Há conversas paradas na fila há mais de 7 dias. Enquanto não forem finalizadas no
              painel, elas contam aqui como se ainda esperassem atendimento.
            </span>
          </p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2.5" aria-label="Atendimentos">
        <Tile
          label="Em atendimento"
          value={queue.in_attendance}
          icon={Headset}
          tone="bg-success/10 text-success"
        />
        <Tile
          label="Em espera"
          value={queue.on_hold}
          icon={PauseCircle}
          tone="bg-warning/10 text-warning"
        />
        <Tile
          label="Com a IA"
          value={queue.with_ai}
          icon={Bot}
          tone="bg-violet-100 text-violet-700"
        />
      </section>

      <ChannelsCard channels={channels} now={now} />

      <TeamCard operators={operators} now={now} age={age} />

      <p className="text-center text-xs text-muted-foreground" role="status">
        {query.isError
          ? `Sem atualização desde ${formatTime(new Date(query.dataUpdatedAt).toISOString())}`
          : `Atualizado há ${age < 60 ? `${Math.floor(age)} s` : formatDuration(age)}`}
      </p>
    </div>
  );
}
