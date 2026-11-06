import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Pencil, Trash2, UserX } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ApiError } from "@/api/client";
import { calendarApi, type CalendarItem, type ItemFields, type ItemKind } from "@/api/calendar";
import { conversationsApi } from "@/api/conversations";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatDayLabel } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import {
  dayKey,
  DURATIONS,
  durationLabel,
  durationOf,
  formatClock,
  itemBadge,
  nextHalfHour,
  toIso,
} from "./calendar";

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.detail : "Não foi possível concluir. Tente de novo.";

function useRefreshCalendar() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["calendar"] });
}

export interface FormSeed {
  item?: CalendarItem;
  day: string;
  lead?: { id: string; name: string } | null;
}

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base";

/** Lead é opcional: compromisso interno não tem. Com lead, cada ação fica no histórico dele. */
function LeadPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (lead: { id: string; name: string } | null) => void;
}) {
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const options = useQuery({
    queryKey: ["calendar", "lead-search", search],
    queryFn: () => calendarApi.searchLeads(search),
    enabled: search.length >= 2,
  });

  if (value) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Lead</p>
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input bg-background pl-3">
          <span className="min-w-0 truncate">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 px-3 text-sm text-primary"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Field
        label="Lead (opcional)"
        type="search"
        value={typed}
        placeholder="Buscar por nome ou telefone"
        onChange={(event) => setTyped(event.target.value)}
      />
      {options.isError && <ErrorText>{errorText(options.error)}</ErrorText>}
      {options.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
      )}
      {!!options.data?.length && (
        <ul className="divide-y rounded-md border">
          {options.data.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() =>
                  onChange({ id: lead.id, name: lead.name || lead.phone || "Sem nome" })
                }
                className="min-h-11 w-full px-3 py-2 text-left text-sm active:bg-muted"
              >
                {lead.name || "Sem nome"}
                {lead.phone && (
                  <span className="block text-xs text-muted-foreground">{lead.phone}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ItemForm({ seed, onDone }: { seed: FormSeed; onDone: () => void }) {
  const user = useCurrentUser();
  const { role } = useWorkspace();
  const manager = isManagerRole(role);
  const refresh = useRefreshCalendar();
  const { item } = seed;
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "event");
  const [title, setTitle] = useState(item?.title ?? "");
  const [day, setDay] = useState(item ? dayKey(new Date(item.start_at)) : seed.day);
  const [time, setTime] = useState(item ? formatClock(item.start_at) : nextHalfHour());
  const [duration, setDuration] = useState(item ? durationOf(item) : 30);
  const [typeId, setTypeId] = useState(item?.type?.id ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [owner, setOwner] = useState(item?.owner?.id ?? user.id);
  const [lead, setLead] = useState<{ id: string; name: string } | null>(
    item?.lead ? { id: item.lead.id, name: item.lead.name ?? "Lead" } : (seed.lead ?? null)
  );
  const typeSelect = useId();
  const durationSelect = useId();
  const ownerSelect = useId();
  const descriptionField = useId();

  const types = useQuery({
    queryKey: ["calendar", "types"],
    queryFn: calendarApi.types,
    staleTime: 300_000,
  });
  const roster = useQuery({
    queryKey: ["roster"],
    queryFn: conversationsApi.roster,
    enabled: manager,
  });

  const save = useMutation({
    mutationFn: () => {
      const start = toIso(day, time);
      const fields: ItemFields = {
        title: title.trim(),
        start_at: start,
        end_at: new Date(new Date(start).getTime() + duration * 60_000).toISOString(),
        description: description.trim(),
        lead_id: lead?.id ?? null,
        type_id: typeId || null,
        // Só o compromisso tem o criador como responsável no servidor; tarefa sem responsável não geraria lembrete.
        ...(manager
          ? { assigned_to: owner || null }
          : !item && kind === "task"
            ? { assigned_to: user.id }
            : {}),
      };
      return item
        ? calendarApi.update(item.kind, item.id, fields)
        : calendarApi.create(kind, fields);
    },
    onSuccess: () => {
      refresh();
      onDone();
    },
  });

  const usableTypes = (types.data ?? []).filter(
    (type) => type.applies_to === "both" || type.applies_to === kind
  );
  const durations = DURATIONS.includes(duration) ? DURATIONS : [duration, ...DURATIONS];

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {!item && (
        <div
          role="group"
          aria-label="Tipo de item"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          {(
            [
              ["event", "Compromisso"],
              ["task", "Tarefa"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setTypeId("");
              }}
              className={`min-h-10 rounded-md text-sm ${kind === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Field
        label="Título"
        required
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Data"
          type="date"
          required
          value={day}
          onChange={(event) => setDay(event.target.value)}
        />
        <Field
          label="Hora"
          type="time"
          required
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={durationSelect} className="block text-sm font-medium">
          Duração
        </label>
        <select
          id={durationSelect}
          className={selectClass}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
        >
          {durations.map((value) => (
            <option key={value} value={value}>
              {durationLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={typeSelect} className="block text-sm font-medium">
          Tipo
        </label>
        <select
          id={typeSelect}
          className={selectClass}
          value={typeId}
          onChange={(event) => setTypeId(event.target.value)}
        >
          <option value="">Sem tipo</option>
          {usableTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      {manager && (
        <div className="space-y-1.5">
          <label htmlFor={ownerSelect} className="block text-sm font-medium">
            Responsável
          </label>
          <select
            id={ownerSelect}
            className={selectClass}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option value="">Sem responsável</option>
            {(roster.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name ?? "Sem nome"}
              </option>
            ))}
          </select>
        </div>
      )}
      <LeadPicker value={lead} onChange={setLead} />
      <div className="space-y-1.5">
        <label htmlFor={descriptionField} className="block text-sm font-medium">
          Descrição
        </label>
        <textarea
          id={descriptionField}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-md border border-input bg-background p-3 text-base"
        />
      </div>
      <ErrorText>{save.isError && errorText(save.error)}</ErrorText>
      <Button
        type="submit"
        block
        loading={save.isPending}
        disabled={!title.trim() || !day || !time}
      >
        {item ? "Salvar alterações" : "Salvar"}
      </Button>
    </form>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{value}</dd>
    </div>
  );
}

export function ItemDetail({
  item,
  onEdit,
  onClose,
}: {
  item: CalendarItem;
  onEdit: () => void;
  onClose: () => void;
}) {
  const refresh = useRefreshCalendar();
  const [confirming, setConfirming] = useState(false);
  const done = () => {
    refresh();
    onClose();
  };
  const remove = useMutation({
    mutationFn: () => calendarApi.remove(item.kind, item.id),
    onSuccess: done,
  });
  const complete = useMutation({
    mutationFn: () => calendarApi.completeTask(item.id),
    onSuccess: done,
  });
  const attendance = useMutation({
    mutationFn: (value: "done" | "no_show") => calendarApi.setAttendance(item.id, value),
    onSuccess: done,
  });
  const badge = itemBadge(item);
  const past = new Date(item.start_at) < new Date();
  const error = remove.error ?? complete.error ?? attendance.error;
  const when = `${formatDayLabel(item.start_at)}, ${formatClock(item.start_at)} às ${formatClock(item.end_at)}`;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="break-words text-lg font-semibold">{item.title}</h3>
        {badge && <p className="text-sm font-medium">{badge.label}</p>}
      </div>
      <dl className="divide-y">
        <InfoLine label="Quando" value={when} />
        <InfoLine label="Tipo" value={item.type?.name} />
        <InfoLine label="Responsável" value={item.owner?.name ?? "Sem responsável"} />
        <InfoLine label="Lead" value={item.lead?.name} />
      </dl>
      {item.description && (
        <p className="whitespace-pre-wrap break-words text-sm">{item.description}</p>
      )}
      {item.meet_link?.startsWith("https://") && (
        <a
          href={item.meet_link}
          target="_blank"
          rel="noreferrer noopener"
          className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Abrir a reunião
        </a>
      )}
      <ErrorText>{error && errorText(error)}</ErrorText>

      {item.kind === "task" && !item.done && (
        <Button block loading={complete.isPending} onClick={() => complete.mutate()}>
          <Check aria-hidden="true" />
          Concluir tarefa
        </Button>
      )}
      {item.kind === "event" && past && item.status !== "cancelled" && (
        <div className="grid grid-cols-2 gap-2">
          <Button loading={attendance.isPending} onClick={() => attendance.mutate("done")}>
            <Check aria-hidden="true" />
            Realizado
          </Button>
          <Button
            variant="outline"
            disabled={attendance.isPending}
            onClick={() => attendance.mutate("no_show")}
          >
            <UserX aria-hidden="true" />
            Não compareceu
          </Button>
        </div>
      )}
      <Button block variant="outline" onClick={onEdit}>
        <Pencil aria-hidden="true" />
        Editar
      </Button>
      {confirming ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm">
            Excluir este item? {item.lead ? "A exclusão fica registrada no histórico do lead." : ""}
          </p>
          <Button
            block
            variant="destructive"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Confirmar exclusão
          </Button>
          <Button block variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button block variant="destructive" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      )}
    </div>
  );
}
