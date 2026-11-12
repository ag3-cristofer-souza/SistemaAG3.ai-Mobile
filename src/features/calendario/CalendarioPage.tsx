import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CloudOff, Plus } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { calendarApi, type CalendarItem } from "@/api/calendar";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatDayLabel } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { getAgendaWeekOnly, setAgendaWeekOnly } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { Sheet } from "@/ui/sheet";
import {
  addDays,
  addMonths,
  dayKey,
  daysWithItems,
  formatClock,
  formatShortDay,
  itemBadge,
  itemsOfDay,
  monthLabel,
  monthWindow,
  parseDay,
  parseItemRef,
} from "./calendar";
import { ItemDetail, ItemForm, type FormSeed } from "./ItemSheets";
import { MonthGrid, WeekStrip } from "./MiniCalendar";

const BADGE_TONE = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

function ItemRow({
  item,
  showDay = false,
  onOpen,
}: {
  item: CalendarItem;
  showDay?: boolean;
  onOpen: () => void;
}) {
  const badge = itemBadge(item);
  const details = [item.type?.name, item.lead?.name, item.owner?.name].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="surface flex min-h-16 w-full gap-3 p-3 text-left active:bg-muted"
      >
        <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">
          {showDay ? formatShortDay(item.start_at) : formatClock(item.start_at)}
        </span>
        <span
          aria-hidden="true"
          className="w-1 shrink-0 self-stretch rounded-full bg-primary"
          style={item.type?.color ? { backgroundColor: item.type.color } : undefined}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block break-words font-medium",
              item.done && "text-muted-foreground line-through"
            )}
          >
            {item.title}
          </span>
          {details && (
            <span className="block truncate text-xs text-muted-foreground">{details}</span>
          )}
          {badge && (
            <span className={cn("block text-xs font-medium", BADGE_TONE[badge.tone])}>
              {badge.label}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

const WIDE_SCREEN = "(min-width: 768px)";

function subscribeWideScreen(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const useWideScreen = () =>
  useSyncExternalStore(subscribeWideScreen, () => window.matchMedia(WIDE_SCREEN).matches);

type Panel = { type: "detail"; item: CalendarItem } | { type: "form"; seed: FormSeed } | null;

export function CalendarioPage() {
  const { role } = useWorkspace();
  const manager = isManagerRole(role);
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [mine, setMine] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const today = dayKey(new Date());
  const date = parseDay(day);
  const range = useMemo(() => monthWindow(parseDay(day)), [day]);
  const wide = useWideScreen();
  const [weekOnly, setWeekOnly] = useState(getAgendaWeekOnly);
  // Em tela larga sobra espaço: o mês fica sempre à vista.
  const showMonth = wide || !weekOnly;
  const month = monthLabel(date);
  // Operador recebe do servidor os dele e os sem responsável. Só o gestor escolhe entre os dele e os de todos.
  const owner = manager && mine ? "me" : undefined;

  const feed = useQuery({
    queryKey: ["calendar", "feed", range.from, owner],
    queryFn: () => calendarApi.feed(range.from, range.to, owner),
  });
  const overdue = useQuery({
    queryKey: ["calendar", "overdue", owner],
    queryFn: () => calendarApi.overdue(range.from, range.to, owner),
  });

  const marked = useMemo(() => daysWithItems(feed.data ?? []), [feed.data]);
  const items = useMemo(() => itemsOfDay(feed.data ?? [], day), [feed.data, day]);

  // Aberto por notificação (`?item=event:<id>`) ou pelo "Agendar" da conversa (`?novo=1&lead=<id>&nome=<nome>`).
  const ref = parseItemRef(params.get("item"));
  const refKey = ref ? `${ref.kind}:${ref.id}` : null;
  const linked = useQuery({
    queryKey: ["calendar", "item", refKey],
    queryFn: () => calendarApi.item(ref!.kind, ref!.id),
    enabled: ref !== null,
  });
  useEffect(() => {
    if (!linked.data) return;
    setDay(dayKey(new Date(linked.data.start_at)));
    const item = linked.data;
    // Uma recarga em segundo plano não pode tirar a pessoa do formulário que está preenchendo.
    setPanel((current) => (current?.type === "form" ? current : { type: "detail", item }));
  }, [linked.data]);
  const wantsNew = params.get("novo") === "1";
  const leadId = params.get("lead");
  const leadName = params.get("nome");
  useEffect(() => {
    if (!wantsNew) return;
    setPanel({
      type: "form",
      seed: { day: today, lead: leadId ? { id: leadId, name: leadName ?? "Lead" } : null },
    });
  }, [wantsNew, leadId, leadName, today]);

  const close = () => {
    setPanel(null);
    if (ref || wantsNew) setParams({}, { replace: true });
  };

  const title =
    panel?.type === "detail"
      ? panel.item.kind === "task"
        ? "Tarefa"
        : "Compromisso"
      : panel?.seed.item
        ? "Editar"
        : "Novo";

  const toggleWeekOnly = () => {
    setAgendaWeekOnly(showMonth);
    setWeekOnly(showMonth);
  };
  const go = (amount: number) =>
    setDay(dayKey(showMonth ? addMonths(date, amount) : addDays(date, amount * 7)));
  const days = { day, today, marked, date, onPick: setDay };

  return (
    <div className="relative h-full">
      {/* No celular, o calendário rola junto com a lista, para não sobrar pouca tela. Em tela larga, são duas colunas. */}
      <div className="h-full overflow-y-auto md:flex md:overflow-hidden">
        <aside className="space-y-2 bg-card p-2 shadow-card md:w-80 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={showMonth ? "Mês anterior" : "Semana anterior"}
              onClick={() => go(-1)}
              className="flex size-11 items-center justify-center"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <h2 className="flex-1 text-center text-sm font-medium">
              {wide ? (
                <span className="inline-block first-letter:uppercase">{month}</span>
              ) : (
                <button
                  type="button"
                  aria-expanded={showMonth}
                  aria-label={`${month}: ${showMonth ? "ver só a semana" : "ver o mês inteiro"}`}
                  onClick={toggleWeekOnly}
                  className="inline-flex min-h-11 items-center gap-1"
                >
                  <span className="inline-block first-letter:uppercase">{month}</span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", showMonth && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              )}
            </h2>
            <button
              type="button"
              aria-label={showMonth ? "Próximo mês" : "Próxima semana"}
              onClick={() => go(1)}
              className="flex size-11 items-center justify-center"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
          {showMonth ? <MonthGrid {...days} /> : <WeekStrip {...days} />}
          {(day !== today || manager) && (
            <div className="flex items-center justify-between gap-2 px-1">
              {day !== today ? (
                <button
                  type="button"
                  onClick={() => setDay(today)}
                  className="min-h-11 text-sm font-medium text-primary"
                >
                  Ir para hoje
                </button>
              ) : (
                <span />
              )}
              {manager && (
                <div
                  role="group"
                  aria-label="De quem"
                  className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
                >
                  {(
                    [
                      [true, "Meus"],
                      [false, "Todos"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={mine === value}
                      onClick={() => setMine(value)}
                      className={cn(
                        "min-h-9 rounded-lg px-3 text-xs font-medium",
                        mine === value
                          ? "bg-card text-foreground shadow-card"
                          : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="p-4 pb-24 md:min-w-0 md:flex-1 md:overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4">
            {day === today && !!overdue.data?.length && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive">
                  Atrasadas: {overdue.data.length}
                </h3>
                <ul className="space-y-2">
                  {overdue.data.map((item) => (
                    <ItemRow
                      showDay
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      onOpen={() => setPanel({ type: "detail", item })}
                    />
                  ))}
                </ul>
              </section>
            )}
            <ErrorText>
              {linked.isError && "Este compromisso não existe mais ou não está na sua agenda."}
            </ErrorText>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold first-letter:uppercase">
                {formatDayLabel(date.toISOString())}
              </h3>
              {feed.isPending && (
                <p className="py-4 text-center text-sm text-muted-foreground">Carregando…</p>
              )}
              {feed.isError && !feed.data && (
                <EmptyState icon={CloudOff} title="Não foi possível carregar a agenda">
                  <p>{feed.error instanceof ApiError ? feed.error.detail : "Tente de novo."}</p>
                  <Button block className="mt-4" onClick={() => void feed.refetch()}>
                    Tentar de novo
                  </Button>
                </EmptyState>
              )}
              {feed.data && items.length === 0 && (
                <EmptyState icon={CalendarDays} title="Nada marcado neste dia" />
              )}
              <ul className="space-y-2">
                {items.map((item) => (
                  <ItemRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onOpen={() => setPanel({ type: "detail", item })}
                  />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Novo compromisso"
        onClick={() => setPanel({ type: "form", seed: { day } })}
        className="absolute bottom-4 right-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-float"
      >
        <Plus className="size-6" aria-hidden="true" />
      </button>

      <Sheet open={panel !== null} title={title} onClose={close}>
        {panel?.type === "detail" && (
          <ItemDetail
            item={panel.item}
            onClose={close}
            onEdit={() => setPanel({ type: "form", seed: { item: panel.item, day } })}
          />
        )}
        {panel?.type === "form" && <ItemForm seed={panel.seed} onDone={close} />}
      </Sheet>
    </div>
  );
}
