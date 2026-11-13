import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  FileText,
  Zap,
} from "lucide-react";
import type { Message } from "@/api/conversations";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isMediaPlaceholder, mediaKind, parseQuote, safeMediaUrl } from "./messages";

function DeliveryStatus({ status }: { status: string | null | undefined }) {
  if (status === "sending") return <Clock className="size-3.5" aria-label="Enviando" role="img" />;
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        Falhou
      </span>
    );
  }
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-sky-500" aria-label="Lida" role="img" />;
  }
  if (status === "delivered")
    return <CheckCheck className="size-3.5" aria-label="Entregue" role="img" />;
  if (status === "sent") return <Check className="size-3.5" aria-label="Enviada" role="img" />;
  return null;
}

function Media({ message }: { message: Message }) {
  const url = safeMediaUrl(message.media_url);
  const kind = mediaKind(message);
  if (!url || !kind) return null;
  if (kind === "image" || kind === "sticker") {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener">
        <img
          src={url}
          alt={kind === "sticker" ? "Figurinha" : "Imagem recebida"}
          loading="lazy"
          className={cn(
            "rounded-xl object-cover",
            kind === "sticker" ? "size-32" : "max-h-72 w-full"
          )}
        />
      </a>
    );
  }
  if (kind === "audio")
    return <audio controls preload="none" src={url} className="h-11 w-60 max-w-full" />;
  if (kind === "video") {
    return <video controls preload="none" src={url} className="max-h-72 w-full rounded-xl" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-h-12 items-center gap-2.5 rounded-xl bg-black/5 px-2.5 py-2"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 truncate font-medium">
        {message.media_caption || "Abrir documento"}
      </span>
    </a>
  );
}

/** Bolha que ainda não chegou ao servidor. */
export interface LocalBubble {
  error?: string;
  onRetry: () => void;
  onDiscard: () => void;
}

interface MessageBubbleProps {
  message: Message;
  /** Falso quando o nome repetiria o da mensagem anterior, ou é o próprio contato numa conversa individual. */
  showSender?: boolean;
  onReply?: (message: Message) => void;
  local?: LocalBubble;
}

export function MessageBubble({ message, showSender = true, onReply, local }: MessageBubbleProps) {
  const senderType = message.sender_type ?? "";
  if (message.message_type === "system_handoff") {
    return (
      <p className="mx-auto my-2 max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-center text-xs font-medium text-secondary-foreground shadow-card">
        {message.body}
      </p>
    );
  }
  const outgoing = senderType === "agent" || senderType === "system" || message.direction === "out";
  if (message.is_deleted) {
    return (
      <div className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
        <p className="rounded-2xl bg-card/70 px-3 py-2 text-sm italic text-muted-foreground">
          Mensagem apagada
        </p>
      </div>
    );
  }
  const { quote, body } = parseQuote(message);
  const kind = mediaKind(message);
  const text = kind && isMediaPlaceholder(body) ? "" : body;
  const caption = kind && kind !== "document" ? message.media_caption : null;
  const sender = !showSender
    ? null
    : senderType === "ai"
      ? "IA"
      : senderType === "system"
        ? "Automação"
        : message.sender_name || null;
  const SenderIcon = senderType === "ai" ? Bot : senderType === "system" ? Zap : null;

  const failed = local && message.delivery_status === "failed";
  return (
    <div className={cn("flex items-center", outgoing ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "max-w-[80%] space-y-1 rounded-2xl px-3 py-2 text-[0.9375rem] leading-snug shadow-card",
          outgoing ? "rounded-tr-md bg-bubble-out text-foreground" : "rounded-tl-md bg-card"
        )}
      >
        {sender && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              senderType === "ai"
                ? "text-violet-700"
                : senderType === "system"
                  ? "text-warning"
                  : "text-primary"
            )}
          >
            {SenderIcon && <SenderIcon className="size-3.5" aria-hidden="true" />}
            {sender}
          </p>
        )}
        {quote && (
          <blockquote className="rounded-lg border-l-[3px] border-primary bg-black/5 px-2 py-1 text-xs">
            <p className="font-semibold text-primary">{quote.author}</p>
            <p className="line-clamp-2 text-muted-foreground">{quote.text}</p>
          </blockquote>
        )}
        <Media message={message} />
        {caption && <p className="whitespace-pre-wrap break-words">{caption}</p>}
        {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
        {message.transcription && (
          <p className="whitespace-pre-wrap break-words text-xs italic text-muted-foreground">
            {message.transcription}
          </p>
        )}
        <p className="flex items-center justify-end gap-1 text-[0.6875rem] text-muted-foreground">
          {formatTime(message.created_at)}
          {outgoing && <DeliveryStatus status={message.delivery_status} />}
        </p>
        {failed && (
          <div className="space-y-1 border-t pt-1">
            {local.error && <p role="alert">{local.error}</p>}
            <div className="flex justify-end gap-3 text-xs font-medium">
              <button type="button" className="min-h-11 px-2" onClick={local.onDiscard}>
                Descartar
              </button>
              <button type="button" className="min-h-11 px-2 text-primary" onClick={local.onRetry}>
                Tentar de novo
              </button>
            </div>
          </div>
        )}
      </div>
      {onReply && !local && (
        <button
          type="button"
          aria-label="Responder"
          onClick={() => onReply(message)}
          className="flex size-11 shrink-0 items-center justify-center text-muted-foreground/50 active:text-foreground"
        >
          <CornerUpLeft className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
