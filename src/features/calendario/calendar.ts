import type { CalendarItem } from "@/api/calendar";

const pad = (value: number) => String(value).padStart(2, "0");

/** Dia local, como chave: `2026-11-06`. */
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDay = (key: string) => {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

/** A semana começa na segunda, como no calendário comercial. */
export function weekOf(date: Date): Date[] {
  const fromMonday = (date.getDay() + 6) % 7;
  const monday = addDays(date, -fromMonday);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const monthLabel = (date: Date) => `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
export const dayLabel = (date: Date) => `${date.getDate()} de ${MONTHS[date.getMonth()]}`;

/** Mesmo dia no mês vizinho; 31 de janeiro vira o último dia de fevereiro, em vez de pular para março. */
export function addMonths(date: Date, amount: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + amount;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

/** Os dias do mini calendário: semanas inteiras, da segunda antes do dia 1 ao domingo depois do último dia. */
export function monthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days: Date[] = [];
  const end = weekOf(last)[6]!;
  for (let day = weekOf(first)[0]!; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Janela do feed: a grade inteira do mês, que sempre contém a semana do dia escolhido. Nunca passa de 42 dias. */
export function monthWindow(date: Date) {
  const days = monthGrid(date);
  return { from: days[0]!.toISOString(), to: addDays(days[days.length - 1]!, 1).toISOString() };
}

export function itemsOfDay(items: CalendarItem[], day: string): CalendarItem[] {
  return items
    .filter((item) => dayKey(new Date(item.start_at)) === day)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export const daysWithItems = (items: CalendarItem[]) =>
  new Set(items.map((item) => dayKey(new Date(item.start_at))));

export function toIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Dia e mês: tarefa atrasada pode ser de outra semana, e só a hora não diria quando venceu. */
export function formatShortDay(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export function durationOf(item: CalendarItem): number {
  return Math.round((new Date(item.end_at).getTime() - new Date(item.start_at).getTime()) / 60_000);
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h${rest ? pad(rest) : ""}`;
}

/** Próxima meia hora cheia, para sugerir no formulário. */
export function nextHalfHour(now = new Date()): string {
  const next = new Date(now);
  next.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

export interface ItemBadge {
  label: string;
  tone: "good" | "bad" | "neutral";
}

export function itemBadge(item: CalendarItem, now = new Date()): ItemBadge | null {
  if (item.status === "cancelled") return { label: "Cancelado", tone: "neutral" };
  if (item.kind === "task") {
    if (item.done) return { label: "Concluída", tone: "good" };
    return item.overdue ? { label: "Atrasada", tone: "bad" } : null;
  }
  if (item.attendance === "done") return { label: "Realizado", tone: "good" };
  if (item.attendance === "no_show") return { label: "Não compareceu", tone: "bad" };
  return new Date(item.end_at) < now ? { label: "Marcar presença", tone: "neutral" } : null;
}

/** `event:<id>` no link da notificação. */
export function parseItemRef(
  value: string | null
): { kind: CalendarItem["kind"]; id: string } | null {
  if (!value) return null;
  const [kind, id] = value.split(":");
  return (kind === "event" || kind === "task") && id ? { kind, id } : null;
}
