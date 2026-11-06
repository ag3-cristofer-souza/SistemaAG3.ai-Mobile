import { ArrowLeft, CheckCircle2, CircleDashed, Mic, Square, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { startOggRecording, type OggRecording } from "@/lib/audio/oggRecorder";
import { currentPlatform, isStandalone } from "@/lib/pwa";
import {
  getPushStatus,
  registerThisDevice,
  requestPushPermission,
  showTestNotification,
  type PushStatus,
} from "@/lib/push";
import { getToken, getWorkspaceId } from "@/lib/session";
import { realtime, useRealtimeState } from "@/realtime";
import { Button } from "@/ui/button";

type Result = "ok" | "fail" | "pending";

const ICONS = {
  ok: { Icon: CheckCircle2, className: "text-success", label: "Funcionou" },
  fail: { Icon: XCircle, className: "text-destructive", label: "Falhou" },
  pending: { Icon: CircleDashed, className: "text-muted-foreground", label: "Pendente" },
};

function Check({
  title,
  result,
  detail,
  children,
}: {
  title: string;
  result: Result;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const { Icon, className, label } = ICONS[result];
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${className}`} aria-label={label} role="img" />
        <div className="min-w-0">
          <h2 className="font-medium">{title}</h2>
          {detail && <p className="break-words text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const PUSH_TEXT: Record<PushStatus, string> = {
  unsupported: "Este navegador não aceita notificações.",
  "needs-install": "No iPhone, instale o app na tela de início para ativar.",
  default: "Permissão ainda não pedida.",
  granted: "Permissão concedida.",
  denied: "Permissão negada. Libere nas configurações do aparelho.",
};

function NotificationsCheck() {
  const [status, setStatus] = useState(getPushStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const loggedIn = !!getToken();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Check
      title="Notificações"
      result={status === "granted" ? "ok" : status === "default" ? "pending" : "fail"}
      detail={PUSH_TEXT[status]}
    >
      {status === "default" && (
        <Button
          block
          loading={busy}
          onClick={() => void run(async () => setStatus(await requestPushPermission()))}
        >
          Ativar notificações
        </Button>
      )}
      {status === "granted" && (
        <>
          <Button
            block
            variant="secondary"
            loading={busy}
            onClick={() =>
              void run(async () => {
                await showTestNotification();
                setMessage("Notificação enviada. Ela deve aparecer no aparelho.");
              })
            }
          >
            Enviar notificação de teste
          </Button>
          {loggedIn ? (
            <Button
              block
              variant="outline"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await registerThisDevice();
                  setMessage(
                    "Aparelho registrado. Envie o teste pelo Django Admin, em Aparelhos com notificação."
                  );
                })
              }
            >
              Registrar para notificação remota
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Entre na conta para testar a notificação remota.
            </p>
          )}
        </>
      )}
      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
    </Check>
  );
}

function AudioCheck() {
  const recording = useRef<OggRecording | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "recording" | "encoding">("idle");
  const [error, setError] = useState("");
  const [clip, setClip] = useState<{ url: string; size: number } | null>(null);
  const [playback, setPlayback] = useState<Result>("pending");

  useEffect(() => () => recording.current?.cancel(), []);

  useEffect(() => {
    if (!clip) return;
    return () => URL.revokeObjectURL(clip.url);
  }, [clip]);

  const start = async () => {
    setError("");
    setClip(null);
    setPlayback("pending");
    setState("starting");
    try {
      recording.current = await startOggRecording();
      setState("recording");
    } catch (caught) {
      setError(messageOf(caught));
      setState("idle");
    }
  };

  const stop = async () => {
    const active = recording.current;
    if (!active) return;
    recording.current = null;
    setState("encoding");
    try {
      const blob = await active.stop();
      setClip({ url: URL.createObjectURL(blob), size: blob.size });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setState("idle");
    }
  };

  const recorded = clip !== null && clip.size > 0;
  const canPlayOgg = {
    probably: "sim",
    maybe: "talvez",
    "": "não",
  }[document.createElement("audio").canPlayType('audio/ogg; codecs="opus"')];

  return (
    <Check
      title="Gravar e tocar áudio (ogg)"
      result={error || playback === "fail" ? "fail" : playback === "ok" ? "ok" : "pending"}
      detail={`O navegador informa que toca ogg: ${canPlayOgg}. Grave alguns segundos e dê play.`}
    >
      {state === "recording" ? (
        <Button block variant="destructive" onClick={() => void stop()}>
          <Square aria-hidden="true" />
          Parar
        </Button>
      ) : (
        <Button block variant="secondary" loading={state !== "idle"} onClick={() => void start()}>
          <Mic aria-hidden="true" />
          Gravar
        </Button>
      )}
      {recorded && (
        <>
          <p className="text-sm text-muted-foreground">
            Gravado em ogg: {(clip.size / 1024).toFixed(1)} KB
          </p>
          <audio
            controls
            src={clip.url}
            className="w-full"
            aria-label="Áudio gravado"
            onPlaying={() => setPlayback("ok")}
            onError={() => setPlayback("fail")}
          />
        </>
      )}
      {playback === "fail" && (
        <p className="text-sm text-destructive" role="alert">
          O aparelho gravou, mas não conseguiu tocar o ogg.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </Check>
  );
}

function ServiceWorkerCheck() {
  const [active, setActive] = useState<boolean | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setActive(false);
      return;
    }
    let alive = true;
    void navigator.serviceWorker.ready.then(() => {
      if (alive) setActive(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Check
      title="Abrir sem conexão"
      result={active === true ? "ok" : active === false ? "fail" : "pending"}
      detail={
        active === false
          ? "Indisponível. O service worker exige HTTPS ou localhost."
          : active
            ? "Pronto: o app abre mesmo sem internet."
            : "Aguardando o service worker."
      }
    />
  );
}

function RealtimeCheck() {
  const state = useRealtimeState();
  const loggedIn = !!getToken();

  // Esta tela fica fora das abas, onde a conexão normal é fechada. Aqui ela abre só para o teste.
  useEffect(() => {
    const workspaceId = getWorkspaceId();
    if (!loggedIn || !workspaceId) return;
    realtime.connect(workspaceId);
    return () => realtime.disconnect();
  }, [loggedIn]);

  return (
    <Check
      title="Tempo real"
      result={state === "online" ? "ok" : state === "unauthorized" ? "fail" : "pending"}
      detail={
        !loggedIn
          ? "Entre na conta para testar."
          : state === "online"
            ? "Conectado ao servidor."
            : state === "unauthorized"
              ? "O servidor recusou a conexão."
              : state === "idle"
                ? "Entre em uma das abas do app e volte para testar."
                : "Conectando ao servidor."
      }
    />
  );
}

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const platform = currentPlatform();
  const standalone = isStandalone();
  const platformName = { ios: "iPhone/iPad", android: "Android", desktop: "Computador" }[platform];

  return (
    <div className="min-h-dvh bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-1 border-b bg-card px-1 pb-1 pt-[calc(0.25rem+env(safe-area-inset-top))]">
        <button
          type="button"
          className="flex size-11 items-center justify-center"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-base font-semibold">Testar este aparelho</h1>
      </header>
      <div className="mx-auto max-w-lg space-y-3 p-4">
        <Check
          title="Instalação"
          result={standalone ? "ok" : "pending"}
          detail={`${platformName}. ${standalone ? "Aberto como app instalado." : "Aberto no navegador."}`}
        />
        <ServiceWorkerCheck />
        <RealtimeCheck />
        <NotificationsCheck />
        <AudioCheck />
      </div>
    </div>
  );
}
