import { Bell, BellOff, ChevronRight, LogOut, Stethoscope } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { enablePush, getPushStatus, type PushStatus } from "@/lib/push";
import { ROLE_LABEL } from "@/lib/roles";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";

const PUSH_TEXT: Record<PushStatus, string> = {
  granted:
    "Ativadas neste aparelho. Você recebe avisos de mensagem nova e de conversa atribuída ou transferida.",
  default:
    "Receba avisos de mensagem nova e de conversa atribuída ou transferida, mesmo com o app fechado.",
  denied:
    "Bloqueadas neste aparelho. Para ativar, libere as notificações deste site nas configurações do navegador.",
  "needs-install": "No iPhone, os avisos só funcionam com o app instalado na tela de início.",
  unsupported: "Este navegador não aceita notificações.",
};

function NotificationsCard() {
  const [status, setStatus] = useState(getPushStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      setStatus(await enablePush());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível ativar. Tente de novo."
      );
    } finally {
      setBusy(false);
    }
  };
  const Icon = status === "granted" ? Bell : BellOff;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="font-medium">Notificações</h2>
          <p className="text-sm text-muted-foreground">{PUSH_TEXT[status]}</p>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {status === "default" && (
        <Button block loading={busy} onClick={() => void activate()}>
          Ativar notificações
        </Button>
      )}
    </section>
  );
}

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

      <NotificationsCard />

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
