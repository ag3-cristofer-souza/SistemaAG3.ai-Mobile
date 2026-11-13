import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  CloudOff,
  Headset,
  MessageCircleOff,
  Smartphone,
  UserRoundX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ApiError } from "@/api/client";
import {
  conversationsApi,
  messageSchema,
  MESSAGES_PAGE_SIZE,
  type Message,
} from "@/api/conversations";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatDayLabel, isSameDay } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { clearConversationNotifications } from "@/lib/push";
import { realtime, type RealtimeChange } from "@/realtime";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { PhotoViewer } from "@/ui/photo-viewer";
import { EmptyState } from "@/ui/feedback";
import { MessageBubble } from "./MessageBubble";
import {
  firstItemIndex,
  flattenMessages,
  removeMessage,
  shouldShowSender,
  upsertMessage,
  type MessagesData,
} from "./messages";
import { ChatActions } from "./ChatActions";
import { Composer } from "./Composer";
import { FunnelBar, LeadInfoSheet } from "./LeadPanels";
import { useInstanceLabel } from "./instances";
import { clientIdOf, isLocalMessage, outbox, pendingBubbles, toLocalMessage } from "./outbox";
import { conversationName, STATUS_LABEL } from "./tabs";

const MARK_READ_THROTTLE_MS = 3_000;
const NO_AGENT = "Sem operador";

const asMessage = (value: unknown): Message | null => {
  const parsed = messageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** Mensagens da conversa aberta: a API traz o histórico, e o foco no WebSocket traz o que chega depois. */
function useLiveMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => ["messages", conversationId], [conversationId]);

  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    staleTime: 0,
    queryFn: ({ pageParam }) => conversationsApi.messages(conversationId, pageParam),
    getNextPageParam: (last) =>
      last.data.length === MESSAGES_PAGE_SIZE ? last.page + 1 : undefined,
  });

  useEffect(() => {
    let markTimer: ReturnType<typeof setTimeout> | null = null;
    const markRead = () => {
      if (markTimer || document.visibilityState === "hidden") return;
      markTimer = setTimeout(() => {
        markTimer = null;
        void conversationsApi.markRead(conversationId);
      }, MARK_READ_THROTTLE_MS);
    };
    const refetch = () => void queryClient.invalidateQueries({ queryKey: key });

    const onMessage = (change: RealtimeChange) => {
      const row = (change.eventType === "DELETE" ? change.old : change.new) ?? {};
      // Sem `conversation_id`: passou do limite do evento, e só o id chegou. O servidor só envia assim se houver foco.
      if (change.truncated || !("conversation_id" in row)) {
        refetch();
        return;
      }
      if (String(row.conversation_id) !== conversationId) return;
      if (change.eventType === "DELETE") {
        queryClient.setQueryData<MessagesData>(key, (data) =>
          data ? removeMessage(data, String(row.id)) : data
        );
        return;
      }
      const message = asMessage(row);
      if (!message) {
        refetch();
        return;
      }
      queryClient.setQueryData<MessagesData>(key, (data) =>
        data ? upsertMessage(data, message) : data
      );
      if (change.eventType === "INSERT" && message.direction !== "out") markRead();
    };

    const offMessage = realtime.on("messages", onMessage);
    // A primeira busca pode terminar antes do foco valer: o que chegou nesse intervalo só vem buscando de novo.
    const offFocused = realtime.onFocused((id) => {
      if (id === conversationId) refetch();
    });
    realtime.focus(conversationId);
    void conversationsApi.markRead(conversationId);
    void clearConversationNotifications(conversationId).catch(() => undefined);
    return () => {
      realtime.focus(null);
      offMessage();
      offFocused();
      if (markTimer) clearTimeout(markTimer);
    };
  }, [conversationId, key, queryClient]);

  return query;
}

function useConversationDetail(conversationId: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => ["conversation", conversationId], [conversationId]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => conversationsApi.get(conversationId),
  });

  useEffect(() => {
    const refetch = () => void queryClient.invalidateQueries({ queryKey: key });
    const offChange = realtime.on("conversations", (change) => {
      if (change.id === conversationId) refetch();
    });
    const offLost = realtime.onUnfocused((id) => {
      if (id === conversationId) refetch();
    });
    return () => {
      offChange();
      offLost();
    };
  }, [conversationId, key, queryClient]);

  return query;
}

interface HeaderDetails {
  status?: string;
  instance?: string | null;
  agent?: string | null;
}

function ChatHeader({
  name,
  details,
  photo,
  onOpen,
  openLabel,
  children,
}: {
  name: string;
  details?: HeaderDetails;
  photo?: string | null;
  /** Toque no nome ou na foto: abre as informações do lead ou, sem lead, a foto. */
  onOpen?: () => void;
  openLabel?: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="flex shrink-0 items-center gap-2 bg-card py-2 pl-1 pr-1 pt-[calc(0.5rem+env(safe-area-inset-top))] shadow-card">
      <button
        type="button"
        aria-label="Voltar"
        // Aberta por notificação ou link, não há para onde voltar no histórico.
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/conversas"))}
        className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </button>
      {/* O botão cobre foto e nome por cima: assim o nome continua sendo o título da tela para o leitor de tela. */}
      <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-xl py-0.5 pr-1 has-[button:active]:bg-muted">
        <Avatar name={name} photo={photo} className="size-10" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] font-semibold leading-tight">{name}</h1>
          {details?.status && (
            <p className="truncate text-xs text-muted-foreground">{details.status}</p>
          )}
        </div>
        {onOpen && (
          <button
            type="button"
            aria-label={openLabel}
            onClick={onOpen}
            className="absolute inset-0 rounded-xl"
          />
        )}
      </div>
      {children}
    </header>
  );
}

/** Por qual instância a conversa chegou e, para o gestor, com qual operador ela está. */
function ConversationInfo({ instance, agent }: Pick<HeaderDetails, "instance" | "agent">) {
  if (!instance && !agent) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/60 bg-card px-4 py-2">
      {instance && (
        <Chip icon={Smartphone}>
          <span className="sr-only">Instância: </span>
          {instance}
        </Chip>
      )}
      {agent && (
        <Chip
          icon={agent === NO_AGENT ? UserRoundX : Headset}
          tone={agent === NO_AGENT ? "warning" : "primary"}
        >
          {agent !== NO_AGENT && <span className="sr-only">Operador: </span>}
          {agent}
        </Chip>
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <div className="flex h-full flex-col">
      <ChatHeader name="Conversa" />
      <EmptyState icon={MessageCircleOff} title="Conversa indisponível">
        <p>Ela não existe ou não está mais com você.</p>
        <Link to="/conversas" className="mt-4 block font-medium text-primary underline">
          Ver minhas conversas
        </Link>
      </EmptyState>
    </div>
  );
}

interface MessageListProps {
  conversationId: string;
  isGroup: boolean;
  onReply: (message: Message) => void;
  /** Muda a cada envio da própria pessoa, para levá-la à mensagem que acabou de mandar. */
  sentCount: number;
}

function MessageList({ conversationId, isGroup, onReply, sentCount }: MessageListProps) {
  const messagesQuery = useLiveMessages(conversationId);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQuery;
  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const pending = useSyncExternalStore(outbox.subscribe, () => outbox.snapshot(conversationId));
  const items = useMemo(
    () => [...messages, ...pendingBubbles(pending, messages).map(toLocalMessage)],
    [messages, pending]
  );
  const anchor = useRef<string | null>(null);
  if (messages.length && !messages.some((item) => item.id === anchor.current)) {
    anchor.current = messages[0]!.id;
  }
  const list = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const first = firstItemIndex(messages, anchor.current);

  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!sentCount) return;
    const frame = requestAnimationFrame(() =>
      list.current?.scrollToIndex({ index: "LAST", behavior: "auto" })
    );
    return () => cancelAnimationFrame(frame);
  }, [sentCount]);

  if (messagesQuery.isPending) {
    return (
      <p className="chat-wallpaper min-h-0 flex-1 p-6 text-center text-sm text-muted-foreground">
        Carregando…
      </p>
    );
  }
  if (messagesQuery.isError && !items.length) {
    return (
      <div className="min-h-0 flex-1">
        <EmptyState icon={CloudOff} title="Não foi possível carregar as mensagens">
          <Button block className="mt-4" onClick={() => void messagesQuery.refetch()}>
            Tentar de novo
          </Button>
        </EmptyState>
      </div>
    );
  }
  if (!items.length) {
    return (
      <p className="chat-wallpaper min-h-0 flex-1 p-6 text-center text-sm text-muted-foreground">
        Nenhuma mensagem ainda.
      </p>
    );
  }

  return (
    <div className="chat-wallpaper relative min-h-0 flex-1" role="log" aria-label="Mensagens">
      <Virtuoso
        ref={list}
        className="h-full"
        data={items}
        firstItemIndex={first}
        initialTopMostItemIndex={items.length - 1}
        startReached={loadOlder}
        followOutput="auto"
        alignToBottom
        atBottomStateChange={setAtBottom}
        computeItemKey={(_, item) => item.id}
        itemContent={(index, item) => {
          const previous = items[index - first - 1];
          const local = isLocalMessage(item)
            ? pending.find((entry) => entry.clientId === clientIdOf(item))
            : undefined;
          return (
            <div className="px-2 py-0.5">
              {(!previous || !isSameDay(previous.created_at, item.created_at)) && (
                <p className="py-2.5 text-center">
                  <span className="inline-block rounded-full bg-card/90 px-3 py-1 text-[0.6875rem] font-medium text-muted-foreground shadow-card">
                    {formatDayLabel(item.created_at)}
                  </span>
                </p>
              )}
              <MessageBubble
                message={item}
                showSender={shouldShowSender(item, previous, isGroup)}
                onReply={onReply}
                local={
                  isLocalMessage(item)
                    ? {
                        error: local?.error,
                        onRetry: () => outbox.retry(clientIdOf(item)),
                        onDiscard: () => outbox.discard(clientIdOf(item)),
                      }
                    : undefined
                }
              />
            </div>
          );
        }}
      />
      {!atBottom && (
        <button
          type="button"
          aria-label="Ir para a última mensagem"
          onClick={() => list.current?.scrollToIndex({ index: "LAST", behavior: "smooth" })}
          className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full bg-card text-primary shadow-float"
        >
          <ArrowDown className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ChatPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const detail = useConversationDetail(id);
  const user = useCurrentUser();
  const { role } = useWorkspace();
  const instanceOf = useInstanceLabel();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    // Fica registrado depois de sair do chat: o envio pode terminar com a pessoa em outra tela.
    outbox.onDelivered((conversationId, message) => {
      queryClient.setQueryData<MessagesData>(["messages", conversationId], (data) =>
        data ? upsertMessage(data, message) : data
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }, [queryClient]);

  if (detail.error instanceof ApiError && detail.error.status === 404) return <Unavailable />;
  const conversation = detail.data;
  const name = conversation ? conversationName(conversation) : "Conversa";
  const photo = conversation?.participant_photo_storage_url;
  // Gestor e admin veem com qual operador a conversa está; o operador só vê quando ela é de outra pessoa.
  const showAgent =
    conversation &&
    !conversation.is_group &&
    (isManagerRole(role) || conversation.assigned_agent_id !== user.id);
  const details: HeaderDetails | undefined = conversation
    ? {
        status: STATUS_LABEL[conversation.status ?? ""],
        instance: instanceOf(conversation),
        agent: showAgent
          ? (conversation.agent_name ?? (isManagerRole(role) ? NO_AGENT : null))
          : null,
      }
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        name={name}
        details={details}
        photo={photo}
        onOpen={
          conversation?.lead_id
            ? () => setInfoOpen(true)
            : photo
              ? () => setPhotoOpen(true)
              : undefined
        }
        openLabel={conversation?.lead_id ? "Informações do lead" : "Ver foto"}
      >
        {conversation && <ChatActions conversation={conversation} />}
      </ChatHeader>
      {conversation?.lead_id && (
        <LeadInfoSheet
          leadId={conversation.lead_id}
          photo={photo}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
      )}
      <PhotoViewer
        src={photo}
        alt={`Foto de ${name}`}
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
      />
      {details && <ConversationInfo instance={details.instance} agent={details.agent} />}
      {conversation?.lead_id && !conversation.is_group && (
        <FunnelBar leadId={conversation.lead_id} />
      )}
      <MessageList
        key={id}
        conversationId={id}
        isGroup={Boolean(conversation?.is_group)}
        onReply={setReplyTo}
        sentCount={sentCount}
      />
      {conversation && (
        <div className="shrink-0 bg-chat pb-[env(safe-area-inset-bottom)]">
          <Composer
            key={id}
            conversation={conversation}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onSent={() => setSentCount((count) => count + 1)}
          />
        </div>
      )}
    </div>
  );
}
