import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CloudOff, MessageCircle, Search, UsersRound } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { conversationsApi, CONVERSATIONS_PAGE_SIZE, type Conversation } from "@/api/conversations";
import { useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatListTime } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/feedback";
import { conversationName, STATUS_LABEL, tabsFor } from "./tabs";
import { useConversationEvents } from "./useConversationEvents";

/** Posição da lista por aba, para voltar do chat no mesmo lugar. Some ao fechar o app. */
const scrollByTab = new Map<string, number>();

function ConversationRow({
  conversation,
  showOwner,
}: {
  conversation: Conversation;
  showOwner: boolean;
}) {
  const name = conversationName(conversation);
  const unread = conversation.unread_count ?? 0;
  const details = showOwner
    ? [
        STATUS_LABEL[conversation.status ?? ""],
        conversation.is_group ? null : (conversation.agent_name ?? "Sem operador"),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <li>
      <Link
        to={`/conversas/${conversation.id}`}
        className="flex min-h-[4.5rem] items-center gap-3 px-4 py-2.5 active:bg-muted"
      >
        <Avatar name={name} photo={conversation.participant_photo_storage_url} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn("min-w-0 flex-1 truncate", unread > 0 && "font-semibold")}>
              {name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatListTime(conversation.last_message_at)}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {conversation.last_message || "Sem mensagens"}
            </span>
            {unread > 0 && (
              <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                <span className="sr-only">Não lidas: </span>
                {unread}
              </span>
            )}
          </span>
          {details && (
            <span className="block truncate text-xs text-muted-foreground">{details}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function ConversasPage() {
  const user = useCurrentUser();
  const { role } = useWorkspace();
  const tabs = useMemo(() => tabsFor(role, user.id), [role, user.id]);
  const [params, setParams] = useSearchParams();
  const active = tabs.find((tab) => tab.key === params.get("aba")) ?? tabs[0]!;
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useConversationEvents();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const counts = useQuery({
    queryKey: ["conversation-counts"],
    queryFn: conversationsApi.counts,
  });

  const list = useInfiniteQuery({
    queryKey: ["conversations", active.key, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      conversationsApi.list({ ...active.filters, search: search || undefined }, pageParam),
    getNextPageParam: (last) =>
      last.data.length === CONVERSATIONS_PAGE_SIZE ? last.page + 1 : undefined,
  });

  const conversations = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages ?? [])
      .flatMap((page) => page.data)
      .filter((item) => !seen.has(item.id) && seen.add(item.id));
  }, [list.data]);

  const hasData = list.data !== undefined;
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element || !hasData) return;
    element.scrollTop = scrollByTab.get(active.key) ?? 0;
  }, [active.key, hasData]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b bg-card pt-2">
        <div className="relative px-4">
          <Search
            className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar conversas"
            className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3"
          />
        </div>
        <div role="tablist" aria-label="Filas" className="flex gap-1 overflow-x-auto px-2">
          {tabs.map((tab) => {
            const selected = tab.key === active.key;
            const count = counts.data?.[tab.countKey];
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setParams({ aba: tab.key }, { replace: true })}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm",
                  selected
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground"
                )}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => scrollByTab.set(active.key, event.currentTarget.scrollTop)}
      >
        {list.isPending && (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
        )}
        {list.isError && !hasData && (
          <EmptyState icon={CloudOff} title="Não foi possível carregar as conversas">
            <p>{list.error instanceof ApiError ? list.error.detail : "Tente de novo."}</p>
            <Button block className="mt-4" onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          </EmptyState>
        )}
        {hasData && conversations.length === 0 && (
          <EmptyState
            icon={active.key === "groups" ? UsersRound : MessageCircle}
            title={search ? "Nada encontrado" : "Nenhuma conversa aqui"}
          >
            {search && <p>Confira o nome ou o telefone e tente de novo.</p>}
          </EmptyState>
        )}
        {conversations.length > 0 && (
          <ul className="divide-y">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                showOwner={isManagerRole(role)}
              />
            ))}
          </ul>
        )}
        {list.hasNextPage && (
          <div className="p-4">
            <Button
              block
              variant="outline"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Carregar mais
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
