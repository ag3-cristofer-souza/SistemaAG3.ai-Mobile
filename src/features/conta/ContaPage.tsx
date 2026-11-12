import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ChevronRight, LogOut, Stethoscope } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { pushApi, type PushPreferences } from "@/api/push";
import { useAuth, useCurrentUser } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { enablePush, getPushStatus, type PushStatus } from "@/lib/push";
import { isManagerRole, ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";

const PUSH_TEXT: Record<PushStatus, string> = {
  granted: "Ativadas neste aparelho. O que você escolher abaixo vale para todos os seus aparelhos.",
  default:
    "Receba avisos de mensagem nova, de conversa atribuída ou transferida e de compromissos, mesmo com o app fechado.",
  denied:
    "Bloqueadas neste aparelho. Para ativar, libere as notificações deste site nas configurações do navegador.",
  "needs-install": "No iPhone, os avisos só funcionam com o app instalado na tela de início.",
  unsupported: "Este navegador não aceita notificações.",
};

const QUEUE_LIMITS = [5, 10, 15, 30, 60];
const PREFERENCES_KEY = ["push", "preferences"];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function NotificationPreferences() {
  const { role } = useWorkspace();
  const queryClient = useQueryClient();
  const limitSelect = useId();
  const preferences = useQuery({ queryKey: PREFERENCES_KEY, queryFn: pushApi.preferences });
  const save = useMutation({
    mutationFn: pushApi.updatePreferences,
    // Muda na hora e volta atrás se o servidor recusar: o interruptor não pode ficar mentindo.
    onMutate: (fields: Partial<PushPreferences>) => {
      const previous = queryClient.getQueryData<PushPreferences>(PREFERENCES_KEY);
      if (previous) queryClient.setQueryData(PREFERENCES_KEY, { ...previous, ...fields });
      return { previous };
    },
    onError: (_error, _fields, context) => {
      if (context?.previous) queryClient.setQueryData(PREFERENCES_KEY, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(PREFERENCES_KEY, saved),
  });

  if (preferences.isPending) return null;
  if (!preferences.data) {
    return <ErrorText>Não foi possível carregar o que você escolheu receber.</ErrorText>;
  }
  const value = preferences.data;
  const limits = QUEUE_LIMITS.includes(value.queue_alert_minutes)
    ? QUEUE_LIMITS
    : [value.queue_alert_minutes, ...QUEUE_LIMITS];
  return (
    <div className="space-y-1 border-t pt-2">
      <Toggle
        label="Mensagens novas"
        checked={value.new_message}
        onChange={(new_message) => save.mutate({ new_message })}
      />
      <Toggle
        label="Conversas atribuídas ou transferidas"
        checked={value.assignment}
        onChange={(assignment) => save.mutate({ assignment })}
      />
      <Toggle
        label="Compromissos"
        checked={value.agenda}
        onChange={(agenda) => save.mutate({ agenda })}
      />
      {isManagerRole(role) && (
        <>
          <Toggle
            label="Alertas da operação"
            hint="Fila sem dono e canal desconectado, das 8h às 20h."
            checked={value.manager_alerts}
            onChange={(manager_alerts) => save.mutate({ manager_alerts })}
          />
          {value.manager_alerts && (
            <div className="space-y-1.5 pb-1">
              <label htmlFor={limitSelect} className="block text-sm">
                Avisar quando alguém esperar na fila por mais de
              </label>
              <select
                id={limitSelect}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base"
                value={value.queue_alert_minutes}
                onChange={(event) =>
                  save.mutate({ queue_alert_minutes: Number(event.target.value) })
                }
              >
                {limits.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      <ErrorText>{save.isError && "Não foi possível salvar. Tente de novo."}</ErrorText>
    </div>
  );
}

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
    <section className="surface space-y-3 p-4">
      <div className="flex gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            status === "granted" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold">Notificações</h2>
          <p className="text-sm text-muted-foreground">{PUSH_TEXT[status]}</p>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {status === "granted" && <NotificationPreferences />}
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
      <section className="brand-gradient flex items-center gap-4 rounded-2xl p-5 shadow-float">
        <Avatar name={name} className="size-14 ring-2 ring-white/40" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          {user.email && <p className="truncate text-sm text-white/80">{user.email}</p>}
          <p className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
            {ROLE_LABEL[role]}
          </p>
        </div>
      </section>

      {workspaces.length > 1 && (
        <section className="surface space-y-1.5 p-4">
          <label htmlFor={selectId} className="block text-sm font-semibold">
            Empresa
          </label>
          <select
            id={selectId}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3"
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
        className="surface flex min-h-14 items-center gap-3 px-4 active:bg-muted"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Stethoscope className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 font-medium">Testar este aparelho</span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
      </Link>

      <Button block variant="destructive" onClick={signOut}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </div>
  );
}
