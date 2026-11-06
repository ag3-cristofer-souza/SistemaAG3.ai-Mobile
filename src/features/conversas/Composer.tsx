import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, ImageIcon, Mic, Paperclip, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ApiError } from "@/api/client";
import {
  conversationsApi,
  type Conversation,
  type Message,
  type MessageKind,
} from "@/api/conversations";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { startOggRecording, type OggRecording } from "@/lib/audio/oggRecorder";
import { formatDuration } from "@/lib/format";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Sheet } from "@/ui/sheet";
import { requiresAssume } from "./actions";
import { parseQuote } from "./messages";
import { outbox, type QuoteDraft } from "./outbox";
import { conversationName } from "./tabs";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // limite de `chat_media` no backend
const MAX_TEXTAREA_PX = 128;

function kindOf(mime: string): MessageKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-50";

/** Pendente ou com a IA: como no painel, é preciso assumir antes de responder. */
function AssumeBar({ conversation }: { conversation: Conversation }) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const assume = useMutation({
    mutationFn: async () => {
      // Assumir não é barrado pelo limite, mas a pessoa precisa saber que a fila dela está cheia.
      const limit = await conversationsApi.agentLimit().catch(() => null);
      try {
        await conversationsApi.assign(conversation.id, user.id);
      } catch (error) {
        const detail =
          error instanceof ApiError
            ? (error.body as { detail?: { retry_after_ms?: number } })?.detail
            : undefined;
        if (!detail?.retry_after_ms) throw error;
        await new Promise((resolve) => setTimeout(resolve, detail.retry_after_ms));
        await conversationsApi.assign(conversation.id, user.id);
      }
      return limit;
    },
    onSuccess: (limit) => {
      if (limit?.is_at_limit) {
        setNotice(
          `Sua fila está em ${limit.active_count} de ${limit.limit} conversas. Finalize ou devolva alguma para liberar espaço.`
        );
      }
      queryClient.setQueryData<Conversation>(["conversation", conversation.id], (current) =>
        current ? { ...current, status: "in_attendance", assigned_agent_id: user.id } : current
      );
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-counts"] });
    },
  });
  return (
    <div className="space-y-2 p-3">
      <p className="text-center text-sm text-muted-foreground">
        {conversation.status === "qualification_in_progress"
          ? "A IA está atendendo. Assuma para responder você mesmo."
          : "Aguardando atendimento. Assuma para responder."}
      </p>
      <ErrorText>
        {assume.isError &&
          (assume.error instanceof ApiError ? assume.error.detail : "Não foi possível assumir.")}
      </ErrorText>
      {notice && <p className="text-sm">{notice}</p>}
      <Button block loading={assume.isPending} onClick={() => assume.mutate()}>
        Assumir e responder
      </Button>
    </div>
  );
}

function useRecorder(onReady: (file: Blob) => void, onError: (message: string) => void) {
  const active = useRef<OggRecording | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "recording" | "encoding">("idle");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => () => active.current?.cancel(), []);

  useEffect(() => {
    if (state !== "recording") return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  const start = async () => {
    setState("starting");
    try {
      active.current = await startOggRecording();
      setState("recording");
    } catch {
      setState("idle");
      onError("Não foi possível usar o microfone. Confira a permissão do navegador.");
    }
  };

  const finish = async () => {
    const recording = active.current;
    if (!recording) return;
    active.current = null;
    setState("encoding");
    try {
      onReady(await recording.stop());
    } catch {
      onError("Não foi possível concluir a gravação.");
    } finally {
      setState("idle");
    }
  };

  const cancel = () => {
    active.current?.cancel();
    active.current = null;
    setState("idle");
  };

  return { state, seconds, start, finish, cancel };
}

function quoteFrom(message: Message, conversation: Conversation): QuoteDraft {
  const text = parseQuote(message).body;
  return {
    author:
      message.sender_type === "user" || message.direction === "in"
        ? message.sender_name || conversationName(conversation)
        : "Agente",
    text: text || (message.media_url ? "[Mídia]" : "..."),
    messageId: message.id,
    providerId: message.z_api_message_id?.trim() || undefined,
    mediaUrl: message.media_url ?? undefined,
    mediaMimeType: message.media_mime_type ?? undefined,
  };
}

interface ComposerProps {
  conversation: Conversation;
  replyTo: Message | null;
  onClearReply: () => void;
  onSent: () => void;
}

export function Composer({ conversation, replyTo, onClearReply, onSent }: ComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);

  const takeQuote = () => {
    const quote = replyTo ? quoteFrom(replyTo, conversation) : undefined;
    onClearReply();
    return quote;
  };

  const recorder = useRecorder((file) => {
    outbox.add(conversation.id, {
      kind: "audio",
      text: "",
      file,
      fileName: `audio_${Date.now()}.ogg`,
      mimeType: "audio/ogg",
      quote: takeQuote(),
    });
    onSent();
  }, setError);

  const sendText = () => {
    const value = text.trim();
    if (!value) return;
    setError("");
    outbox.add(conversation.id, { kind: "text", text: value, quote: takeQuote() });
    setText("");
    if (textarea.current) textarea.current.style.height = "auto";
    textarea.current?.focus();
    onSent();
  };

  const sendFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // sem isso, escolher o mesmo arquivo de novo não dispara o evento
    setAttachOpen(false);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("O arquivo passa do limite de 100 MB.");
      return;
    }
    setError("");
    const mimeType = file.type || "application/octet-stream";
    outbox.add(conversation.id, {
      kind: kindOf(mimeType),
      text: "",
      file,
      fileName: file.name,
      mimeType,
      quote: takeQuote(),
    });
    onSent();
  };

  if (requiresAssume(conversation)) return <AssumeBar conversation={conversation} />;

  const quote = replyTo ? quoteFrom(replyTo, conversation) : null;
  const recording = recorder.state === "recording" || recorder.state === "encoding";

  return (
    <div>
      {quote && (
        <div className="flex items-center gap-2 border-b py-1 pl-3 pr-1">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2 text-xs">
            <p className="font-medium">Respondendo a {quote.author}</p>
            <p className="truncate text-muted-foreground">{quote.text}</p>
          </div>
          <button
            type="button"
            aria-label="Cancelar resposta"
            onClick={onClearReply}
            className={iconButton}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
      {error && <ErrorText className="px-3 pt-2">{error}</ErrorText>}

      {recording ? (
        <div className="flex items-center gap-2 p-1.5">
          <button
            type="button"
            aria-label="Descartar gravação"
            onClick={recorder.cancel}
            className={iconButton}
            disabled={recorder.state === "encoding"}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
          <p className="flex-1 text-center text-sm tabular-nums" role="status">
            {recorder.state === "encoding"
              ? "Preparando o áudio…"
              : `Gravando ${formatDuration(recorder.seconds)}`}
          </p>
          <button
            type="button"
            aria-label="Enviar áudio"
            onClick={() => void recorder.finish()}
            disabled={recorder.state === "encoding"}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 p-1.5">
          <button
            type="button"
            aria-label="Anexar"
            onClick={() => setAttachOpen(true)}
            className={iconButton}
          >
            <Paperclip className="size-5" aria-hidden="true" />
          </button>
          <textarea
            ref={textarea}
            rows={1}
            value={text}
            placeholder="Mensagem"
            aria-label="Mensagem"
            onChange={(event) => {
              setText(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight + 2, MAX_TEXTAREA_PX)}px`;
            }}
            className="min-h-11 flex-1 resize-none rounded-3xl border border-input bg-background px-4 py-2.5 leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {text.trim() ? (
            <button
              type="button"
              aria-label="Enviar"
              onClick={sendText}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Send className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Gravar áudio"
              disabled={recorder.state === "starting"}
              onClick={() => {
                setError("");
                void recorder.start();
              }}
              className={iconButton}
            >
              <Mic className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <input
        ref={gallery}
        type="file"
        hidden
        accept="image/*,video/*"
        aria-label="Foto ou vídeo"
        onChange={sendFile}
      />
      <input
        ref={camera}
        type="file"
        hidden
        accept="image/*"
        capture="environment"
        aria-label="Câmera"
        onChange={sendFile}
      />
      <input ref={documents} type="file" hidden aria-label="Documento" onChange={sendFile} />
      <Sheet open={attachOpen} title="Anexar" onClose={() => setAttachOpen(false)}>
        <div className="py-1">
          {[
            { icon: ImageIcon, label: "Foto ou vídeo", input: gallery },
            { icon: Camera, label: "Câmera", input: camera },
            { icon: FileText, label: "Documento", input: documents },
          ].map(({ icon: Icon, label, input }) => (
            <button
              key={label}
              type="button"
              onClick={() => input.current?.click()}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-muted"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
