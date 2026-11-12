import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Navigate, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { keepDeviceRegistered } from "@/lib/push";
import { isManagerRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import globo from "@/assets/globo.svg";
import { realtime, useRealtimeState } from "@/realtime";
import { safePath } from "@/sw-logic";
import { homeFor, navItemsFor } from "./navigation";

const STATUS = {
  online: { label: "Ao vivo", dot: "bg-success", pill: "bg-success/10 text-success" },
  connecting: { label: "Conectando", dot: "bg-warning", pill: "bg-warning/10 text-warning" },
  reconnecting: { label: "Reconectando", dot: "bg-warning", pill: "bg-warning/10 text-warning" },
  unauthorized: {
    label: "Sem conexão",
    dot: "bg-destructive",
    pill: "bg-destructive/10 text-destructive",
  },
  idle: {
    label: "Sem conexão",
    dot: "bg-muted-foreground",
    pill: "bg-muted text-muted-foreground",
  },
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
  useEffect(() => {
    void keepDeviceRegistered();
  }, []);
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
      <header className="flex shrink-0 items-center gap-3 bg-card px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-card">
        <img src={globo} alt="" width={32} height={32} className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">
            AG3
          </p>
          <h1 className="truncate text-base font-semibold leading-tight">
            {workspace.company_name ?? "AG3"}
          </h1>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            status.pill
          )}
          role="status"
        >
          <span className="relative flex size-2" aria-hidden="true">
            {state === "online" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", status.dot)} />
          </span>
          {status.label}
        </span>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="flex shrink-0 border-t bg-card px-1 pb-[env(safe-area-inset-bottom)]"
      >
        {navItemsFor(role).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem]",
                isActive ? "font-semibold text-foreground" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-secondary text-primary" : ""
                  )}
                >
                  <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                </span>
                {label}
              </>
            )}
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
