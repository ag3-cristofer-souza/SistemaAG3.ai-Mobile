import { ChevronRight, LogOut, Stethoscope } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";
import { useAuth, useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { ROLE_LABEL } from "@/lib/roles";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";

export function ContaPage() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { workspace, workspaces, role, switchWorkspace } = useWorkspace();
  const selectId = useId();
  const name = user.full_name || user.email || "Usuário";

  return (
    <div className="space-y-4 p-4">
      <section className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Avatar name={name} className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          {user.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[role]}</p>
        </div>
      </section>

      {workspaces.length > 1 && (
        <section className="space-y-1.5 rounded-lg border bg-card p-4">
          <label htmlFor={selectId} className="block text-sm font-medium">
            Empresa
          </label>
          <select
            id={selectId}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            value={workspace.company_id}
            onChange={(event) => switchWorkspace(event.target.value)}
          >
            {workspaces.map((item) => (
              <option key={item.company_id} value={item.company_id}>
                {item.company_name ?? item.company_id}
              </option>
            ))}
          </select>
        </section>
      )}

      <Link
        to="/diagnostico"
        className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-4"
      >
        <Stethoscope className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">Testar este aparelho</span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
      </Link>

      <Button block variant="destructive" onClick={signOut}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </div>
  );
}
