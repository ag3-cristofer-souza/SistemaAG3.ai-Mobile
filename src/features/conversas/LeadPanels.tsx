import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  History,
  Mail,
  MapPin,
  Megaphone,
  NotebookText,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { ApiError } from "@/api/client";
import { crmApi } from "@/api/crm";
import { formatDayLabel, formatPhone, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { PhotoViewer } from "@/ui/photo-viewer";
import { Sheet } from "@/ui/sheet";
import { historyDetail, historyLabel, stageLabel } from "./funnel";
import { useLeadCard } from "./useLeadCard";

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.detail : "Não foi possível concluir. Tente de novo.";

const when = (iso: string) => `${formatDayLabel(iso)}, ${formatTime(iso)}`;

/** Faixa abaixo do cabeçalho: mostra a etapa do funil e abre a troca de etapa e a descrição no CRM. */
export function FunnelBar({ leadId }: { leadId: string }) {
  const { card, stages, access, loading, move, assume, addNote } = useLeadCard(leadId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const noteId = useId();

  if (loading) return null;
  const close = () => {
    setOpen(false);
    setSaved(false);
    move.reset();
    assume.reset();
    addNote.reset();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-2 border-t border-border/60 bg-card px-4 text-left text-sm"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Funil:
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
              card ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {card ? stageLabel(stages, card.status) : "Sem card neste lead"}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      <Sheet open={open} title="Funil e descrição" onClose={close}>
        <div className="space-y-4 p-4">
          {access === "assume" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Este card está sem dono. Assuma para mudar a etapa.
              </p>
              <Button block loading={assume.isPending} onClick={() => assume.mutate()}>
                Assumir card
              </Button>
              <ErrorText>{assume.isError && errorText(assume.error)}</ErrorText>
            </div>
          )}
          {access === "other" && (
            <p className="text-sm text-muted-foreground">
              Este card é de {card?.assignedToName ?? "outro operador"}: só ele pode mudar a etapa.
            </p>
          )}
          {card && (
            <fieldset disabled={access !== "move"}>
              <legend className="mb-1.5 text-sm font-medium">Etapa do funil</legend>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-muted/50">
                {stages.map((stage) => {
                  // Marca na hora, sem esperar o servidor. Se ele recusar, volta para a etapa real e mostra o erro.
                  const current = stage.key === (move.isPending ? move.variables : card.status);
                  return (
                    <li key={stage.key}>
                      <label
                        className={cn(
                          "flex min-h-12 items-center gap-3 px-3.5 text-sm",
                          current && "bg-secondary font-semibold text-secondary-foreground",
                          access !== "move" && "text-muted-foreground"
                        )}
                      >
                        <input
                          type="radio"
                          name="etapa"
                          className="size-4 accent-primary"
                          checked={current}
                          onChange={() => move.mutate(stage.key)}
                        />
                        {stage.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <ErrorText className="mt-2">{move.isError && errorText(move.error)}</ErrorText>
            </fieldset>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);
              addNote.mutate(text.trim(), {
                onSuccess: () => {
                  setText("");
                  setSaved(true);
                },
              });
            }}
          >
            <label htmlFor={noteId} className="block text-sm font-medium">
              Descrição no CRM
            </label>
            <textarea
              id={noteId}
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full rounded-xl border border-input bg-background p-3"
            />
            <ErrorText>{addNote.isError && errorText(addNote.error)}</ErrorText>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                Descrição salva no lead.
              </p>
            )}
            <Button type="submit" block loading={addNote.isPending} disabled={!text.trim()}>
              Salvar descrição
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {children}
    </h3>
  );
}

function LeadInfo({ leadId, photo }: { leadId: string; photo?: string | null }) {
  const [zoom, setZoom] = useState(false);
  const lead = useQuery({ queryKey: ["lead", leadId], queryFn: () => crmApi.lead(leadId) });
  const origin = useQuery({
    queryKey: ["lead-origin", leadId],
    queryFn: () => crmApi.firstOrigin(leadId),
    retry: false,
  });
  const history = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: () => crmApi.history(leadId),
    staleTime: 0,
  });
  const notes = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: () => crmApi.notes(leadId),
    staleTime: 0,
  });
  const place = [lead.data?.city, lead.data?.state].filter(Boolean).join(" - ");
  const name = lead.data?.name || "Lead";
  const originLabel = origin.data ?? lead.data?.source;

  return (
    <div className="space-y-5 px-4 pb-4 pt-1">
      {lead.isError && <ErrorText>{errorText(lead.error)}</ErrorText>}
      {lead.data && (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            {photo ? (
              <button
                type="button"
                aria-label="Ampliar foto"
                onClick={() => setZoom(true)}
                className="rounded-full ring-4 ring-secondary transition-transform active:scale-95"
              >
                <Avatar name={name} photo={photo} className="size-24 text-2xl" />
              </button>
            ) : (
              <Avatar name={name} className="size-20 text-xl" />
            )}
            <PhotoViewer
              src={photo}
              alt={`Foto de ${name}`}
              open={zoom}
              onClose={() => setZoom(false)}
            />
            <div className="min-w-0">
              <p className="break-words text-base font-semibold">{name}</p>
            </div>
          </div>
          <dl className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-muted/50">
            <InfoLine
              icon={Phone}
              label="Telefone"
              value={formatPhone(lead.data.phone) || lead.data.phone}
            />
            <InfoLine icon={Mail} label="E-mail" value={lead.data.email} />
            <InfoLine icon={Building2} label="Empresa" value={lead.data.company_name} />
            <InfoLine icon={MapPin} label="Cidade" value={place} />
            <InfoLine
              icon={CalendarClock}
              label="Entrou em"
              value={lead.data.created_at && when(lead.data.created_at)}
            />
            <InfoLine icon={Megaphone} label="Origem" value={originLabel} />
          </dl>
        </>
      )}

      <section className="space-y-2.5">
        <SectionTitle icon={NotebookText}>Descrições</SectionTitle>
        {notes.isError && <ErrorText>Não foi possível carregar as descrições.</ErrorText>}
        {notes.data?.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhuma descrição ainda.
          </p>
        )}
        <ul className="space-y-2">
          {notes.data?.map((note) => (
            <li key={note.id} className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="whitespace-pre-wrap break-words">{note.content}</p>
              {note.created_at && (
                <p className="mt-1.5 text-xs text-muted-foreground">{when(note.created_at)}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2.5">
        <SectionTitle icon={History}>Histórico</SectionTitle>
        {history.isError && <ErrorText>Não foi possível carregar o histórico.</ErrorText>}
        {history.data?.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nada registrado ainda.
          </p>
        )}
        <ol className="relative ml-1.5 space-y-4 border-l-2 border-secondary pl-5">
          {history.data?.map((item) => {
            const detail = historyDetail(item);
            return (
              <li key={item.id} className="relative text-sm">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-card bg-primary"
                />
                <p className="font-semibold">{historyLabel(item.kind)}</p>
                {detail && <p className="break-words">{detail}</p>}
                {item.description && (
                  <p className="break-words text-muted-foreground">{item.description}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.actor_name} · {when(item.created_at)}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** O que aconteceu com o lead. Abre ao tocar no nome ou na foto, no cabeçalho do chat. */
export function LeadInfoSheet({
  leadId,
  photo,
  open,
  onClose,
}: {
  leadId: string;
  photo?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} title="Informações do lead" onClose={onClose}>
      {open && <LeadInfo leadId={leadId} photo={photo} />}
    </Sheet>
  );
}
