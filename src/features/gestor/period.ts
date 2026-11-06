export type PeriodKey = "today" | "7d" | "30d" | "month";

export const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const pad = (value: number) => String(value).padStart(2, "0");
const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function startOf(key: PeriodKey, now: Date): Date {
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const back = key === "7d" ? 6 : key === "30d" ? 29 : 0;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
}

/** Mesmo recorte do painel (`rangeFor`, em `useOverviewData.ts`): do começo do dia até agora, em instantes. */
export function instantRange(key: PeriodKey, now = new Date()) {
  return { start: startOfDay(startOf(key, now)).toISOString(), end: now.toISOString() };
}

/** O mesmo período, em dias locais: é o que os relatórios de marketing e origem aceitam. */
export function dayRange(key: PeriodKey, now = new Date()) {
  return { start: localDay(startOf(key, now)), end: localDay(now) };
}

export const asPeriod = (value: string | null): PeriodKey =>
  PERIODS.some((item) => item.key === value) ? (value as PeriodKey) : "today";

/** Variação sobre o período anterior. Sem base de comparação, não há o que dizer: `null`. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const formatInt = (value: number) => value.toLocaleString("pt-BR");
export const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export function formatMoney(value: number, currency: string | null = "BRL"): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}
