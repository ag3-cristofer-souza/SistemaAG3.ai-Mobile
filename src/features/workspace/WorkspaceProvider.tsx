import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CloudOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { workspacesApi, type Workspace } from "@/api/workspaces";
import { useAuth, useCurrentUser } from "@/features/auth/AuthProvider";
import { effectiveRole, type AppRole } from "@/lib/roles";
import { getWorkspaceId, setWorkspaceId } from "@/lib/session";
import { WORKSPACE_PARAM } from "@/sw-logic";
import { Button } from "@/ui/button";
import { EmptyState, FullScreenLoader } from "@/ui/feedback";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: Workspace[];
  role: AppRole;
  switchWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const QUERY_KEY = ["workspaces"];

export function RequireWorkspace() {
  const { signOut } = useAuth();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(getWorkspaceId);
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: workspacesApi.list,
    staleTime: 5 * 60_000,
  });

  const workspaces = useMemo(() => query.data ?? [], [query.data]);
  // Empresa guardada que deixou de ser acessível cai na principal.
  const workspace =
    workspaces.find((item) => item.company_id === selectedId) ??
    workspaces.find((item) => item.is_primary) ??
    workspaces[0];

  // Antes de montar as telas: as consultas delas já saem com o cabeçalho X-Company-Id.
  if (workspace && getWorkspaceId() !== workspace.company_id) setWorkspaceId(workspace.company_id);

  const switchWorkspace = useCallback(
    (id: string) => {
      setWorkspaceId(id);
      setSelectedId(id);
      // Dados de outra empresa não podem aparecer nem por um instante.
      queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== QUERY_KEY[0] });
      navigate("/", { replace: true });
    },
    [navigate, queryClient]
  );

  // Aviso de outra empresa: entra nela antes de abrir a conversa, que daria 404 na empresa selecionada.
  const [params] = useSearchParams();
  const requested = params.get(WORKSPACE_PARAM);
  const mustSwitch =
    requested !== null &&
    requested !== workspace?.company_id &&
    workspaces.some((item) => item.company_id === requested);

  useEffect(() => {
    if (!mustSwitch || !requested) return;
    setWorkspaceId(requested);
    queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== QUERY_KEY[0] });
    setSelectedId(requested);
  }, [mustSwitch, requested, queryClient]);

  const value = useMemo(
    () =>
      workspace
        ? {
            workspace,
            workspaces,
            role: effectiveRole(user, workspace.company_id),
            switchWorkspace,
          }
        : null,
    [workspace, workspaces, user, switchWorkspace]
  );

  if (query.isPending || mustSwitch) return <FullScreenLoader />;
  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.detail : "Tente de novo.";
    return (
      <div className="h-dvh">
        <EmptyState icon={CloudOff} title="Não foi possível carregar suas empresas">
          <p>{message}</p>
          <Button block className="mt-4" onClick={() => void query.refetch()}>
            Tentar de novo
          </Button>
        </EmptyState>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="h-dvh">
        <EmptyState icon={Building2} title="Sem empresa vinculada">
          <p>Peça ao administrador da sua empresa para liberar seu acesso.</p>
          <Button block variant="ghost" className="mt-4" onClick={signOut}>
            Sair
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider value={value}>
      <Outlet />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace precisa estar dentro de RequireWorkspace");
  return context;
}
