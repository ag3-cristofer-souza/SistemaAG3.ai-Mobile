import {
  Bot,
  ChevronRight,
  Clock,
  Inbox,
  Plug,
  Radio,
  ShieldCheck,
  Unplug,
  UserRound,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LiveChannel, LiveDashboard } from "@/api/dashboard";
import { formatDuration, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sheet } from "@/ui/sheet";
import { channelAlerts, messagingLimitLabel, providerLabel, qualityLabel } from "./channels";
import { CHIP_TONE } from "./alerts";
import { AlertList, DetailLine } from "./detail";

type Tab = "off" | "on";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Canais da empresa em duas guias; tocar num canal abre o detalhe com os alertas. */
export function ChannelsCard({
  channels,
  now,
}: {
  channels: LiveDashboard["channels"];
  now: number;
}) {
  const total = channels.connected + channels.disconnected.length;
  const items = channels.items;
  const [tab, setTab] = useState<Tab>(channels.disconnected.length > 0 ? "off" : "on");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items?.find((channel) => channel.id === openId) ?? null;

  const header = (
    <h2 className="flex items-center gap-2 px-4 pt-3.5 text-sm font-semibold">
      <Radio className="size-4 text-primary" aria-hidden="true" />
      Canais: {channels.connected} de {total} conectado{channels.connected === 1 ? "" : "s"}
    </h2>
  );

  // Servidor sem o detalhe: só a lista de desconectados, como antes.
  if (!items) {
    return (
      <section className="surface overflow-hidden">
        {header}
        {channels.disconnected.length === 0 ? (
          <p className="px-4 pb-3.5 pt-2 text-sm text-muted-foreground">
            Nenhum canal desconectado.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/70">
            {channels.disconnected.map((channel) => (
              <li key={channel.id} className="flex items-center gap-3 px-4 py-3">
                <StatusIcon connected={false} />
                <span className="min-w-0 flex-1 truncate font-medium">{channel.name}</span>
                <StatusPill connected={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const shown = items.filter((channel) => channel.connected === (tab === "on"));

  return (
    <section className="surface overflow-hidden">
      {header}
      <div
        role="tablist"
        aria-label="Situação dos canais"
        className="mx-4 mt-3 flex rounded-xl bg-muted p-1"
      >
        <TabButton
          active={tab === "off"}
          onClick={() => setTab("off")}
          count={channels.disconnected.length}
        >
          Desconectados
        </TabButton>
        <TabButton active={tab === "on"} onClick={() => setTab("on")} count={channels.connected}>
          Conectados
        </TabButton>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 pb-4 pt-3 text-sm text-muted-foreground">
          {tab === "off" ? "Nenhum canal desconectado." : "Nenhum canal conectado."}
        </p>
      ) : (
        <ul className="mt-1.5 divide-y divide-border/70">
          {shown.map((channel) => (
            <li key={channel.id}>
              <ChannelRow channel={channel} now={now} onOpen={() => setOpenId(channel.id)} />
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open !== null} title="Detalhes do canal" onClose={() => setOpenId(null)}>
        {open && <ChannelDetail channel={open} now={now} />}
      </Sheet>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
      )}
    >
      {children}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 text-xs font-semibold tabular-nums",
          active ? "bg-primary/10 text-primary" : "bg-card/70"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatusIcon({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl",
        connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      {connected ? (
        <Plug className="size-4" aria-hidden="true" />
      ) : (
        <Unplug className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
        connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      {connected ? "Conectado" : "Desconectado"}
    </span>
  );
}

function ChannelRow({
  channel,
  now,
  onOpen,
}: {
  channel: LiveChannel;
  now: number;
  onOpen: () => void;
}) {
  // "Sem conexão" já está na guia; na linha vale o próximo alerta.
  const alerts = channelAlerts(channel, now).filter((alert) => alert.title !== "Sem conexão");
  const top = alerts[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
    >
      <StatusIcon connected={channel.connected} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{channel.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {channel.number && <span>{formatPhone(channel.number)}</span>}
          {top ? (
            <span className={cn("rounded-full px-2 py-0.5 font-medium", CHIP_TONE[top.tone])}>
              {top.title}
              {alerts.length > 1 && ` +${alerts.length - 1}`}
            </span>
          ) : (
            channel.connected && (
              <span className="flex items-center gap-1 text-success">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Sem alertas
              </span>
            )
          )}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function ChannelDetail({ channel, now }: { channel: LiveChannel; now: number }) {
  const alerts = channelAlerts(channel, now);
  const meta = channel.meta;
  const quality = qualityLabel(meta?.quality ?? null);
  const limit = messagingLimitLabel(meta?.messaging_limit ?? null);
  const lastMessage = channel.last_message_at
    ? `há ${formatDuration(Math.max(0, (now - new Date(channel.last_message_at).getTime()) / 1000))}`
    : "Nenhuma ainda";

  return (
    <div className="space-y-4 px-4 pt-2">
      <div className="flex items-center gap-3">
        <StatusIcon connected={channel.connected} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold leading-tight">{channel.name}</h3>
          {channel.number && (
            <p className="text-sm text-muted-foreground">{formatPhone(channel.number)}</p>
          )}
        </div>
        <StatusPill connected={channel.connected} />
      </div>

      {alerts.length > 0 ? (
        <AlertList alerts={alerts} />
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm text-success">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Nenhum alerta neste canal.
        </p>
      )}

      <dl className="surface divide-y divide-border/70 overflow-hidden">
        <DetailLine icon={Radio} label="Provedor" value={providerLabel(channel.provider)} />
        <DetailLine
          icon={Inbox}
          label="Fila do canal"
          value={
            channel.pending === 0
              ? "Nenhuma pendente"
              : `${plural(channel.pending, "pendente", "pendentes")}, ${channel.unassigned} sem operador`
          }
        />
        <DetailLine icon={Clock} label="Última mensagem" value={lastMessage} />
        <DetailLine icon={UserRound} label="Responsável" value={channel.owner ?? "Ninguém"} />
        <DetailLine
          icon={Users}
          label="Equipe"
          value={channel.team.length > 0 ? channel.team.join(", ") : "Ninguém vinculado"}
        />
        <DetailLine icon={Bot} label="IA" value={channel.ai_assistant ?? "Desligada"} />
      </dl>

      {meta && (
        <section aria-label="Conta Meta">
          <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conta Meta
          </h4>
          <dl className="surface divide-y divide-border/70 overflow-hidden">
            <DetailLine
              icon={ShieldCheck}
              label="Envio"
              value={
                meta.situacao === "bloqueada"
                  ? "Bloqueado"
                  : meta.situacao === "limitada"
                    ? "Limitado"
                    : meta.situacao === "disponivel"
                      ? "Liberado"
                      : "Não verificado"
              }
            />
            {quality && <DetailLine icon={ShieldCheck} label="Qualidade" value={quality} />}
            {limit && <DetailLine icon={Inbox} label="Limite" value={limit} />}
            <DetailLine
              icon={Radio}
              label="Modo"
              value={meta.mode === "coexistence" ? "Coexistência (app + API)" : "Só API"}
            />
            {meta.checked_at && (
              <DetailLine
                icon={Clock}
                label="Verificado"
                value={new Date(meta.checked_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            )}
          </dl>
        </section>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Para reconectar ou mudar a configuração do canal, use o painel.
      </p>
    </div>
  );
}
