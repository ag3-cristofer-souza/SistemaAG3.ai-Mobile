import { CloudOff } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/api/client";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/feedback";
import { formatInt } from "./period";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-2">
      {children}
    </section>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-medium">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export interface RankItem {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

/** Comparação de grandeza: uma cor só, com o número sempre escrito ao lado. Sem o número, a barra não diria o valor. */
export function RankBars({ items, empty }: { items: RankItem[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{formatInt(item.value)}</span>
          </div>
          <div aria-hidden="true" className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Série diária. O total e o maior dia ficam escritos, e cada barra tem o próprio valor para leitor de tela. */
export function DayBars({
  days,
  unit,
}: {
  days: Array<{ date: string; value: number }>;
  unit: string;
}) {
  if (days.length < 2) return null;
  const max = Math.max(...days.map((day) => day.value), 1);
  const best = days.reduce((top, day) => (day.value > top.value ? day : top), days[0]!);
  return (
    <div>
      <div className="flex h-24 items-end gap-0.5" role="list" aria-label={`${unit} por dia`}>
        {days.map((day) => (
          <div
            key={day.date}
            role="listitem"
            aria-label={`${shortDay(day.date)}: ${formatInt(day.value)} ${unit}`}
            title={`${shortDay(day.date)}: ${formatInt(day.value)}`}
            className="min-w-0 flex-1 rounded-t-sm bg-primary"
            style={{ height: `${Math.max((day.value / max) * 100, day.value ? 4 : 1)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{shortDay(days[0]!.date)}</span>
        <span>{shortDay(days[days.length - 1]!.date)}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Maior dia: {shortDay(best.date)}, com {formatInt(best.value)} {unit}.
      </p>
    </div>
  );
}

export function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState icon={CloudOff} title="Não foi possível carregar">
      <p>{error instanceof ApiError ? error.detail : "Tente de novo."}</p>
      <Button block className="mt-4" onClick={onRetry}>
        Tentar de novo
      </Button>
    </EmptyState>
  );
}

export const Loading = () => (
  <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
);
