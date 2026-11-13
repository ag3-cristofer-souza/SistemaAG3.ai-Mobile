import type { LiveOperator } from "@/api/dashboard";
import { formatDuration } from "@/lib/format";
import { ALERT_ORDER, type Alert } from "./alerts";

const DAY_S = 24 * 3600;
/** Esperando o aceite há mais que isto: já não é fila do dia, é conversa esquecida com a pessoa. */
export const STALE_ACCEPT_S = 7 * DAY_S;
/** A partir disto a espera do aceite vira aviso. */
const SLOW_ACCEPT_S = 3600;
/** Sem acessar há mais que isto vale mencionar. */
const AWAY_S = 7 * DAY_S;

const SYSTEM_LABEL: Record<string, string> = { mobile: "App", painel: "Painel" };

export const systemsLabel = (systems: string[]) =>
  systems.map((system) => SYSTEM_LABEL[system] ?? system).join(" e ");

export const atLimit = ({ active, limit }: LiveOperator) =>
  limit !== null && limit > 0 && active >= limit;

/** Há quanto tempo a mais antiga espera o aceite, contando o tempo desde a foto do servidor (`age`, em segundos). */
export const oldestWait = (operator: LiveOperator, age = 0): number | null =>
  operator.oldest_active_seconds === null ? null : operator.oldest_active_seconds + age;

/** Segundos desde a última atividade; `null` sem registro. */
export function awaySeconds(operator: LiveOperator, now: number): number | null {
  if (!operator.last_seen_at) return null;
  return Math.max(0, (now - new Date(operator.last_seen_at).getTime()) / 1000);
}

/** "Online no App e Painel", "Offline, visto há 2 d" ou só "Offline". */
export function presenceLabel(operator: LiveOperator, now: number): string {
  if (operator.online) return `Online no ${systemsLabel(operator.systems)}`;
  const away = awaySeconds(operator, now);
  return away === null ? "Offline" : `Offline, visto há ${formatDuration(away)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** O que o gestor precisa saber do operador, do mais grave para o menos grave. */
export function operatorAlerts(operator: LiveOperator, now: number, age = 0): Alert[] {
  const alerts: Alert[] = [];
  const oldest = oldestWait(operator, age);
  if (oldest !== null && oldest >= SLOW_ACCEPT_S) {
    const stale = oldest >= STALE_ACCEPT_S;
    alerts.push({
      tone: stale ? "danger" : "warning",
      title: `A mais antiga espera o aceite há ${formatDuration(oldest)}`,
      detail: stale
        ? "Conversa parada assim ocupa o limite da pessoa e não anda. Transfira ou finalize no painel."
        : "O cliente ainda não teve resposta.",
    });
  }
  if (atLimit(operator)) {
    alerts.push({
      tone: "warning",
      title: "No limite de conversas",
      detail: "A distribuição automática não passa conversas novas enquanto estiver no limite.",
    });
  }
  if (!operator.online && operator.active > 0) {
    alerts.push({
      tone: "warning",
      title: `Offline com ${plural(operator.active, "conversa", "conversas")} esperando o aceite`,
    });
  }
  if (!operator.online) {
    const away = awaySeconds(operator, now);
    if (away === null) {
      alerts.push({ tone: "info", title: "Sem registro de acesso ao app ou ao painel" });
    } else if (away >= AWAY_S) {
      alerts.push({ tone: "info", title: `Sem acessar há ${Math.floor(away / DAY_S)} dias` });
    }
  }
  return alerts.sort((a, b) => ALERT_ORDER[a.tone] - ALERT_ORDER[b.tone]);
}
