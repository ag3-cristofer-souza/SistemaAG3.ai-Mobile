import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Navigate, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { isManagerRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { realtime, useRealtimeState } from "@/realtime";
import { safePath } from "@/sw-logic";
import { homeFor, navItemsFor } from "./navigation";

const STATUS = {
  online: { label: "Ao vivo", dot: "bg-success" },
  connecting: { label: "Conectando", dot: "bg-warning" },
  reconnecting: { label: "Reconectando", dot: "bg-warning" },
  unauthorized: { label: "Sem conexão", dot: "bg-destructive" },
  idle: { label: "Sem conexão", dot: "bg-muted-foreground" },
} as const;

/** Mantém a conexão de tempo real ligada à empresa ativa e recarrega o que pode ter sido perdido. */
function useRealtimeBridge(companyId: string) {
  const queryClient = useQueryClient();
  const { revalidate } = useAuth();

  useEffect(() => {
    realtime.connect(companyId);
    const offResync = realtime.onResync(() => void queryClient.invalidateQueries());
    const offRevoked = realtime.onRevoked(
      () => void queryClient.invalidateQueries({ queryKey: ["workspaces"] })
    );
    const offState = realtime.onState((state) => {
      if (state === "unauthorized") revalidate();
    });
    return () => {
      offResync();
      offRevoked();
      offState();
      realtime.disconnect();
    };
  }, [companyId, queryClient, revalidate]);
}

/** O service worker pede para abrir um caminho quando o usuário toca em uma notificação com o app aberto. */
function useNotificationNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const worker = navigator.serviceWorker;
    if (!worker) return;
    const onMessage = (event: MessageEvent) => {
      const { type, url } = (event.data ?? {}) as { type?: string; url?: string };
      if (type === "navigate") navigate(safePath(url));
    };
    worker.addEventListener("message", onMessage);
    return () => worker.removeEventListener("message", onMessage);
  }, [navigate]);
}

export function AppShell() {
  const { workspace, role } = useWorkspace();
  const state = useRealtimeState();
  useRealtimeBridge(workspace.company_id);
  useNotificationNavigation();
  const inChat = useMatch("/conversas/:id");
  const status = STATUS[state];

  // O chat ocupa a tela toda, como em um app de mensagens, e tem cabeçalho próprio.
  if (inChat) {
    return (
      <div className="relative h-dvh overflow-hidden bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    // `relative` e `overflow-hidden`: texto oculto (`sr-only`) é posicionado de forma absoluta e, sem isso, escaparia da
    // lista que rola e aumentaria a altura da página inteira.
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
        <h1 className="truncate text-base font-semibold">{workspace.company_name ?? "AG3"}</h1>
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
        >
          <span className={cn("size-2 rounded-full", status.dot)} aria-hidden="true" />
          {status.label}
        </span>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="flex shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)]"
      >
        {navItemsFor(role).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
                isActive ? "font-medium text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function RoleHome() {
  const { role } = useWorkspace();
  return <Navigate to={homeFor(role)} replace />;
}

/** A tela do gestor. Operador que abrir o endereço volta para a dele; quem protege os dados é o servidor. */
export function RequireManager() {
  const { role } = useWorkspace();
  if (!isManagerRole(role)) return <Navigate to={homeFor(role)} replace />;
  return <Outlet />;
}
