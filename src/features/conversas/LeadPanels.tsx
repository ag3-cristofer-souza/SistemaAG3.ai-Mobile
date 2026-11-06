import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleAlert } from "lucide-react";
import { useId, useState } from "react";
import { ApiError } from "@/api/client";
import { crmApi } from "@/api/crm";
import { formatDayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
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
        className="flex min-h-11 shrink-0 items-center gap-2 border-b bg-card px-4 text-left text-sm"
      >
        <span className="text-muted-foreground">Funil:</span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {card ? stageLabel(stages, card.status) : "Sem card neste lead"}
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
              <ul className="divide-y rounded-md border">
                {stages.map((stage) => {
                  // Marca na hora, sem esperar o servidor. Se ele recusar, volta para a etapa real e mostra o erro.
                  const current = stage.key === (move.isPending ? move.variables : card.status);
                  return (
                    <li key={stage.key}>
                      <label
                        className={cn(
                          "flex min-h-11 items-center gap-3 px-3 text-sm",
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
              className="w-full rounded-md border border-input bg-background p-3"
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

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{value}</dd>
    </div>
  );
}

function LeadInfo({ leadId }: { leadId: string }) {
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

  return (
    <div className="space-y-5 p-4">
      {lead.isError && <ErrorText>{errorText(lead.error)}</ErrorText>}
      {lead.data && (
        <dl className="divide-y">
          <InfoLine label="Nome" value={lead.data.name} />
          <InfoLine label="Telefone" value={lead.data.phone} />
          <InfoLine label="E-mail" value={lead.data.email} />
          <InfoLine label="Empresa" value={lead.data.company_name} />
          <InfoLine label="Cidade" value={place} />
          <InfoLine label="Entrou em" value={lead.data.created_at && when(lead.data.created_at)} />
          <InfoLine label="Origem" value={origin.data ?? lead.data.source} />
        </dl>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Descrições</h3>
        {notes.isError && <ErrorText>Não foi possível carregar as descrições.</ErrorText>}
        {notes.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma descrição ainda.</p>
        )}
        <ul className="space-y-2">
          {notes.data?.map((note) => (
            <li key={note.id} className="rounded-md border p-3 text-sm">
              <p className="whitespace-pre-wrap break-words">{note.content}</p>
              {note.created_at && (
                <p className="mt-1 text-xs text-muted-foreground">{when(note.created_at)}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Histórico</h3>
        {history.isError && <ErrorText>Não foi possível carregar o histórico.</ErrorText>}
        {history.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
        )}
        <ol className="space-y-3 border-l pl-3">
          {history.data?.map((item) => {
            const detail = historyDetail(item);
            return (
              <li key={item.id} className="text-sm">
                <p className="font-medium">{historyLabel(item.kind)}</p>
                {detail && <p className="break-words">{detail}</p>}
                {item.description && (
                  <p className="break-words text-muted-foreground">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
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

/** O ponto de exclamação do cabeçalho: o que aconteceu com o lead. */
export function LeadInfoButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Informações do lead"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <CircleAlert className="size-5" aria-hidden="true" />
      </button>
      <Sheet open={open} title="Informações do lead" onClose={() => setOpen(false)}>
        {open && <LeadInfo leadId={leadId} />}
      </Sheet>
    </>
  );
}
