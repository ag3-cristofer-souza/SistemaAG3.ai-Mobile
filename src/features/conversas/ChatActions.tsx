import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Bot,
  CalendarPlus,
  CheckCircle2,
  MoreVertical,
  NotebookPen,
  PauseCircle,
  PlayCircle,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { conversationsApi, type Conversation } from "@/api/conversations";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { formatDayLabel, formatTime } from "@/lib/format";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Sheet } from "@/ui/sheet";
import { availableActions } from "./actions";
import { conversationName } from "./tabs";
import { useLeadCard } from "./useLeadCard";

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.detail : "Não foi possível concluir. Tente de novo.";

function useRefreshConversation(conversationId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["conversation-counts"] });
  };
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-muted"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {label}
    </button>
  );
}

function TransferForm({
  conversation,
  onDone,
}: {
  conversation: Conversation;
  onDone: () => void;
}) {
  const user = useCurrentUser();
  const selectId = useId();
  const noteId = useId();
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const roster = useQuery({ queryKey: ["roster"], queryFn: conversationsApi.roster });
  const transfer = useMutation({
    mutationFn: () => conversationsApi.transfer(conversation.id, target, note.trim()),
    onSuccess: onDone,
  });
  const people = (roster.data ?? []).filter(
    (person) => person.id !== user.id && person.id !== conversation.assigned_agent_id
  );
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        transfer.mutate();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-sm font-medium">
          Transferir para
        </label>
        <select
          id={selectId}
          required
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">{roster.isPending ? "Carregando…" : "Selecione"}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name ?? "Sem nome"}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={noteId} className="block text-sm font-medium">
          Motivo
        </label>
        <textarea
          id={noteId}
          required
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-md border border-input bg-background p-3"
        />
      </div>
      <ErrorText>
        {roster.isError && "Não foi possível carregar a lista de operadores."}
        {transfer.isError && errorText(transfer.error)}
      </ErrorText>
      <Button type="submit" block loading={transfer.isPending} disabled={!target || !note.trim()}>
        Transferir
      </Button>
    </form>
  );
}

function NotesPanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const key = ["conversation-notes", conversationId];
  const inputId = useId();
  const [text, setText] = useState("");
  const notes = useQuery({
    queryKey: key,
    queryFn: () => conversationsApi.notes(conversationId),
    staleTime: 0,
  });
  const roster = useQuery({ queryKey: ["roster"], queryFn: conversationsApi.roster });
  const add = useMutation({
    mutationFn: () => conversationsApi.addNote(conversationId, text.trim()),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const nameOf = (id: string | null) =>
    roster.data?.find((person) => person.id === id)?.full_name ?? "Equipe";
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">O cliente não vê estas anotações.</p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Nova anotação
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={text}
          placeholder="Nova anotação"
          onChange={(event) => setText(event.target.value)}
          className="w-full rounded-md border border-input bg-background p-3"
        />
        <ErrorText>{add.isError && errorText(add.error)}</ErrorText>
        <Button type="submit" block loading={add.isPending} disabled={!text.trim()}>
          Salvar anotação
        </Button>
      </form>
      {notes.isError && <ErrorText>Não foi possível carregar as anotações.</ErrorText>}
      {notes.data?.length === 0 && (
        <p className="py-2 text-center text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
      )}
      <ul className="space-y-2">
        {notes.data?.map((note) => (
          <li key={note.id} className="rounded-md border p-3 text-sm">
            <p className="whitespace-pre-wrap break-words">{note.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nameOf(note.created_by)}
              {note.created_at &&
                ` · ${formatDayLabel(note.created_at)}, ${formatTime(note.created_at)}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Panel = "menu" | "transfer" | "notes" | "finish" | "queue" | "ai" | null;

/** Finalizar é o momento de registrar como terminou: etapa do funil e descrição no CRM, as duas opcionais. */
function FinishForm({
  conversation,
  onDone,
  onCancel,
}: {
  conversation: Conversation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const stageId = useId();
  const noteId = useId();
  const { card, stages, access, move, addNote } = useLeadCard(conversation.lead_id);
  const [chosen, setChosen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const stage = chosen ?? card?.status ?? "";
  const finish = useMutation({
    mutationFn: async () => {
      // O atendimento fecha por último: se a etapa ou a descrição falharem, nada foi encerrado pela metade.
      if (access === "move" && stage && stage !== card?.status) await move.mutateAsync(stage);
      if (conversation.lead_id && text.trim()) await addNote.mutateAsync(text.trim());
      await conversationsApi.finish(conversation.id);
    },
    onSuccess: onDone,
  });
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        finish.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        O atendimento será encerrado e sairá da sua fila.
      </p>
      {card && access === "move" && (
        <div className="space-y-1.5">
          <label htmlFor={stageId} className="block text-sm font-medium">
            Etapa do funil
          </label>
          <select
            id={stageId}
            value={stage}
            onChange={(event) => setChosen(event.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
          >
            {stages.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {conversation.lead_id && (
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="block text-sm font-medium">
            Descrição no CRM (opcional)
          </label>
          <textarea
            id={noteId}
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-input bg-background p-3"
          />
        </div>
      )}
      <ErrorText>{finish.isError && errorText(finish.error)}</ErrorText>
      <Button type="submit" block loading={finish.isPending}>
        Finalizar
      </Button>
      <Button block variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    </form>
  );
}

const CONFIRM = {
  queue: {
    title: "Devolver para a fila?",
    text: "A conversa volta para a fila para outro operador assumir.",
    action: "Devolver",
    run: conversationsApi.returnToQueue,
  },
  ai: {
    title: "Devolver para a IA?",
    text: "A IA volta a responder esta conversa, e ela deixa de estar com você.",
    action: "Devolver para a IA",
    run: conversationsApi.returnToAi,
  },
} as const;

/** Botão do cabeçalho do chat, com as ações da conversa. Depois de passá-la adiante, volta para a lista. */
export function ChatActions({ conversation }: { conversation: Conversation }) {
  const [panel, setPanel] = useState<Panel>(null);
  const navigate = useNavigate();
  const refresh = useRefreshConversation(conversation.id);
  const available = availableActions(conversation);
  const close = () => setPanel(null);

  const leave = () => {
    close();
    refresh();
    navigate("/conversas", { replace: true });
  };

  const toggleHold = useMutation({
    mutationFn: () =>
      (available.resume ? conversationsApi.resume : conversationsApi.hold)(conversation.id),
    onSuccess: () => {
      close();
      refresh();
    },
  });

  const confirmation = panel === "ai" || panel === "queue" ? CONFIRM[panel] : null;
  const confirm = useMutation({
    mutationFn: () => (confirmation ? confirmation.run(conversation.id) : Promise.resolve()),
    onSuccess: leave,
  });

  const title =
    panel === "transfer"
      ? "Transferir atendimento"
      : panel === "notes"
        ? "Anotações internas"
        : panel === "finish"
          ? "Finalizar atendimento?"
          : (confirmation?.title ?? "Ações da conversa");

  return (
    <>
      <button
        type="button"
        aria-label="Mais ações"
        onClick={() => {
          toggleHold.reset();
          confirm.reset();
          setPanel("menu");
        }}
        className="ml-auto flex size-11 shrink-0 items-center justify-center"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
      </button>
      <Sheet open={panel !== null} title={title} onClose={close}>
        {panel === "menu" && (
          <div className="py-1">
            {(available.hold || available.resume) && (
              <ActionRow
                icon={available.resume ? PlayCircle : PauseCircle}
                label={available.resume ? "Retomar atendimento" : "Colocar em espera"}
                onClick={() => toggleHold.mutate()}
              />
            )}
            {available.transfer && (
              <ActionRow
                icon={ArrowRightLeft}
                label="Transferir"
                onClick={() => setPanel("transfer")}
              />
            )}
            {available.returnToQueue && (
              <ActionRow
                icon={Undo2}
                label="Devolver para a fila"
                onClick={() => setPanel("queue")}
              />
            )}
            {available.returnToAi && (
              <ActionRow icon={Bot} label="Devolver para a IA" onClick={() => setPanel("ai")} />
            )}
            {available.finish && (
              <ActionRow
                icon={CheckCircle2}
                label="Finalizar atendimento"
                onClick={() => setPanel("finish")}
              />
            )}
            {conversation.lead_id && (
              <ActionRow
                icon={CalendarPlus}
                label="Agendar compromisso"
                onClick={() => {
                  const query = new URLSearchParams({
                    novo: "1",
                    lead: conversation.lead_id!,
                    nome: conversationName(conversation),
                  });
                  navigate(`/calendario?${query}`);
                }}
              />
            )}
            <ActionRow
              icon={NotebookPen}
              label="Anotações internas"
              onClick={() => setPanel("notes")}
            />
            {toggleHold.isError && (
              <ErrorText className="px-4 py-2">{errorText(toggleHold.error)}</ErrorText>
            )}
          </div>
        )}
        {panel === "transfer" && <TransferForm conversation={conversation} onDone={leave} />}
        {panel === "notes" && <NotesPanel conversationId={conversation.id} />}
        {panel === "finish" && (
          <FinishForm conversation={conversation} onDone={leave} onCancel={close} />
        )}
        {confirmation && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{confirmation.text}</p>
            <ErrorText>{confirm.isError && errorText(confirm.error)}</ErrorText>
            <Button block loading={confirm.isPending} onClick={() => confirm.mutate()}>
              {confirmation.action}
            </Button>
            <Button block variant="ghost" onClick={close}>
              Cancelar
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
