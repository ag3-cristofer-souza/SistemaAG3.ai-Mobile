import type { LiveChannel } from "@/api/dashboard";
import { formatPhone } from "@/lib/format";

import { ALERT_ORDER, type Alert } from "./alerts";

export type ChannelAlert = Alert;

const DAY_MS = 24 * 3600 * 1000;
/** Canal conectado e calado por mais que isto merece conferência (o atraso da Wafly em novembro passou despercebido). */
export const SILENT_DAYS = 3;
/** Por quanto tempo a troca de número continua aparecendo. */
const NUMBER_CHANGE_DAYS = 30;

const PROVIDERS: Record<string, string> = {
  meta: "Meta (API oficial)",
  zapi: "Z-API",
  wafly: "Wafly",
  evolution: "Evolution",
};

export const providerLabel = (provider: string | null): string =>
  (provider && PROVIDERS[provider.toLowerCase()]) || provider || "Não informado";

const LIMITS: Record<string, string> = {
  TIER_50: "50 conversas por dia",
  TIER_250: "250 conversas por dia",
  TIER_1K: "1 mil conversas por dia",
  TIER_2K: "2 mil conversas por dia",
  TIER_10K: "10 mil conversas por dia",
  TIER_100K: "100 mil conversas por dia",
  TIER_UNLIMITED: "Sem limite",
};

export const messagingLimitLabel = (tier: string | null): string | null =>
  tier ? (LIMITS[tier.toUpperCase()] ?? tier) : null;

const QUALITY: Record<string, string> = { GREEN: "Alta", YELLOW: "Média", RED: "Baixa" };

export const qualityLabel = (quality: string | null): string | null =>
  quality ? (QUALITY[quality.toUpperCase()] ?? quality) : null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const KEEPALIVE: Record<string, ChannelAlert> = {
  warning: {
    tone: "warning",
    title: "WhatsApp Business sem uso há 10 dias ou mais",
    detail: "Abra o app no celular deste número. Com 14 dias sem uso, a Meta desconecta o canal.",
  },
  critical: {
    tone: "danger",
    title: "WhatsApp Business sem uso há 12 dias ou mais",
    detail:
      "Abra o app no celular deste número ainda hoje. Com 14 dias sem uso, a Meta desconecta.",
  },
  disconnected: {
    tone: "danger",
    title: "WhatsApp Business sem uso há 14 dias ou mais",
    detail:
      "A Meta pode ter desconectado o app deste número. Abra o app no celular e confira no painel.",
  },
};

/** O que o gestor precisa saber do canal, do mais grave para o menos grave. */
export function channelAlerts(channel: LiveChannel, now = Date.now()): ChannelAlert[] {
  const alerts: ChannelAlert[] = [];
  const meta = channel.meta;

  if (!channel.connected) {
    alerts.push({
      tone: "danger",
      title: "Sem conexão",
      detail: "Não recebe nem envia mensagens por este número até ser reconectado no painel.",
    });
  }
  if (meta?.situacao === "bloqueada" || meta?.situacao === "limitada") {
    const blocked = meta.situacao === "bloqueada";
    alerts.push({
      tone: blocked ? "danger" : "warning",
      title: blocked ? "Envio bloqueado pela Meta" : "Envio limitado pela Meta",
      detail: blocked
        ? "Recebe mensagens, mas não consegue iniciar conversas nem disparar modelos."
        : "Consegue enviar, mas com restrições.",
    });
    for (const problem of meta.problemas) {
      alerts.push({
        tone: problem.gravidade === "bloqueada" ? "danger" : "warning",
        title: problem.codigo ? `${problem.titulo} (${problem.codigo})` : problem.titulo,
        detail: problem.acao || undefined,
      });
    }
  }
  const quality = meta?.quality?.toUpperCase();
  if (quality === "RED") {
    alerts.push({
      tone: "danger",
      title: "Qualidade do número baixa",
      detail: "A Meta pode restringir o número. Reduza o volume de disparos e revise o conteúdo.",
    });
  } else if (quality === "YELLOW") {
    alerts.push({
      tone: "warning",
      title: "Qualidade do número em atenção",
      detail: "Muitos contatos bloquearam ou denunciaram. Revise os disparos.",
    });
  }
  if (meta?.mode === "coexistence") {
    const keepalive = KEEPALIVE[meta.keepalive_status];
    if (keepalive) alerts.push(keepalive);
  }
  if (channel.connected && channel.last_message_at) {
    const silent = Math.floor((now - new Date(channel.last_message_at).getTime()) / DAY_MS);
    if (silent >= SILENT_DAYS) {
      alerts.push({
        tone: "warning",
        title: `Nenhuma mensagem há ${silent} dias`,
        detail: "Confira se o número continua recebendo mensagens.",
      });
    }
  }
  if (channel.unassigned > 0) {
    alerts.push({
      tone: "warning",
      title: `${plural(channel.unassigned, "conversa", "conversas")} sem operador neste canal`,
    });
  }
  if (!channel.owner && channel.team.length === 0) {
    alerts.push({
      tone: "info",
      title: "Ninguém da equipe responde por este canal",
      detail: "As conversas novas dele dependem da distribuição automática ou da IA.",
    });
  }
  if (channel.number_changed_at) {
    const age = now - new Date(channel.number_changed_at).getTime();
    if (age >= 0 && age <= NUMBER_CHANGE_DAYS * DAY_MS) {
      alerts.push({
        tone: "info",
        title: `O número mudou em ${day(channel.number_changed_at)}`,
        detail: channel.previous_number
          ? `Antes era ${formatPhone(channel.previous_number)}.`
          : undefined,
      });
    }
  }
  if (channel.sync_error) {
    alerts.push({ tone: "info", title: "Não foi possível atualizar o perfil deste número" });
  }
  return alerts.sort((a, b) => ALERT_ORDER[a.tone] - ALERT_ORDER[b.tone]);
}
