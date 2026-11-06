import { cn } from "@/lib/utils";
import { dayKey, dayLabel, monthGrid, weekOf, WEEKDAYS } from "./calendar";

interface DaysProps {
  /** Dia escolhido (`dayKey`). */
  day: string;
  today: string;
  /** Dias com algum item na janela carregada. */
  marked: Set<string>;
  onPick: (day: string) => void;
}

const withItems = (label: string, has: boolean) => (has ? `${label}, com compromissos` : label);

/** O mês inteiro, para escolher o dia e ver de relance onde há compromissos. */
export function MonthGrid({ day, today, marked, onPick, date }: DaysProps & { date: Date }) {
  return (
    <div>
      <div
        aria-hidden="true"
        className="grid grid-cols-7 text-center text-xs text-muted-foreground"
      >
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>
      <div role="group" aria-label="Dias do mês" className="grid grid-cols-7">
        {monthGrid(date).map((value) => {
          const key = dayKey(value);
          const selected = key === day;
          const isToday = key === today;
          const outside = value.getMonth() !== date.getMonth();
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={withItems(dayLabel(value), marked.has(key))}
              onClick={() => onPick(key)}
              className="relative flex h-11 items-center justify-center text-sm"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full tabular-nums",
                  selected
                    ? "bg-primary font-medium text-primary-foreground"
                    : isToday
                      ? "font-semibold text-primary ring-1 ring-primary"
                      : outside && "text-muted-foreground/60"
                )}
              >
                {value.getDate()}
              </span>
              {marked.has(key) && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-px size-1 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Só a semana do dia escolhido, para sobrar mais tela para a lista no celular. */
export function WeekStrip({ day, today, marked, onPick, date }: DaysProps & { date: Date }) {
  return (
    <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
      {weekOf(date).map((value, index) => {
        const key = dayKey(value);
        const selected = key === day;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            aria-current={key === today ? "date" : undefined}
            aria-label={withItems(`${WEEKDAYS[index]} ${dayLabel(value)}`, marked.has(key))}
            onClick={() => onPick(key)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center rounded-lg text-xs",
              selected
                ? "bg-primary text-primary-foreground"
                : key === today
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
            )}
          >
            <span>{WEEKDAYS[index]}</span>
            <span className="text-sm font-medium">{value.getDate()}</span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-1 rounded-full",
                marked.has(key)
                  ? selected
                    ? "bg-primary-foreground"
                    : "bg-primary"
                  : "bg-transparent"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
