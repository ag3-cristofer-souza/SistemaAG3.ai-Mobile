import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CloudOff,
  Headset,
  MessageCircle,
  Search,
  Smartphone,
  UserRoundX,
  UsersRound,
} from "lucide-react";
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
import { Chip } from "@/ui/chip";
import { EmptyState } from "@/ui/feedback";
import { useInstanceLabel } from "./instances";
import { conversationName, STATUS_LABEL, STATUS_TONE, tabsFor } from "./tabs";
import { useConversationEvents } from "./useConversationEvents";

/** Posição da lista por aba, para voltar do chat no mesmo lugar. Some ao fechar o app. */
const scrollByTab = new Map<string, number>();

function ConversationRow({
  conversation,
  showOwner,
  instance,
}: {
  conversation: Conversation;
  showOwner: boolean;
  instance: string | null;
}) {
  const name = conversationName(conversation);
  const unread = conversation.unread_count ?? 0;
  const status = conversation.status ?? "";
  const owner = conversation.is_group ? null : conversation.agent_name;
  return (
    <li>
      <Link
        to={`/conversas/${conversation.id}`}
        className="flex items-start gap-3 px-4 py-3 active:bg-muted"
      >
        <span className="relative mt-0.5">
          <Avatar name={name} photo={conversation.participant_photo_storage_url} />
          {conversation.is_group && (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
              <UsersRound className="size-2.5" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[0.9375rem]",
                unread > 0 ? "font-semibold" : "font-medium"
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                unread > 0 ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {formatListTime(conversation.last_message_at)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                unread > 0 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {conversation.last_message || "Sem mensagens"}
            </span>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground">
                <span className="sr-only">Não lidas: </span>
                {unread}
              </span>
            )}
          </span>
          {(instance || showOwner) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1">
              {showOwner && STATUS_LABEL[status] && (
                <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>
              )}
              {instance && (
                <Chip icon={Smartphone}>
                  <span className="sr-only">Instância: </span>
                  {instance}
                </Chip>
              )}
              {showOwner &&
                !conversation.is_group &&
                (owner ? (
                  <Chip icon={Headset} tone="primary">
                    <span className="sr-only">Operador: </span>
                    {owner}
                  </Chip>
                ) : (
                  <Chip icon={UserRoundX} tone="warning">
                    Sem operador
                  </Chip>
                ))}
            </span>
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
  const instanceOf = useInstanceLabel();
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
      <div className="shrink-0 space-y-2.5 bg-card pb-2.5 pt-1 shadow-card">
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
            className="min-h-11 w-full rounded-full bg-muted pl-9 pr-4 outline-none placeholder:text-muted-foreground focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div
          role="tablist"
          aria-label="Filas"
          className="flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]"
        >
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
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "bg-muted font-medium text-muted-foreground active:bg-secondary"
                )}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums",
                      selected ? "bg-white/25" : "bg-card text-foreground"
                    )}
                  >
                    {count}
                  </span>
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
          <ul className="mt-2 divide-y divide-border/70 bg-card">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                showOwner={isManagerRole(role)}
                instance={instanceOf(conversation)}
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
