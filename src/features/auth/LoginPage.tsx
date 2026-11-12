import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { authApi, isMfaChallenge, type MfaChallenge } from "@/api/auth";
import { ApiError } from "@/api/client";
import { BRAND_BUTTON, BRAND_INPUT, BrandCard, BrandScreen } from "@/ui/brand";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.detail : "Algo deu errado. Tente de novo.";

type Step =
  | { name: "password"; notice?: string }
  | { name: "mfa"; challenge: MfaChallenge }
  | { name: "forgot" };

export function LoginPage() {
  const { state } = useAuth();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [email, setEmail] = useState("");

  if (state.status === "authed") return <Navigate to="/" replace />;

  return (
    <BrandScreen>
      <BrandCard>
        {step.name === "password" && (
          <PasswordStep
            email={email}
            onEmail={setEmail}
            notice={step.notice}
            onChallenge={(challenge) => setStep({ name: "mfa", challenge })}
            onForgot={() => setStep({ name: "forgot" })}
          />
        )}
        {step.name === "mfa" && (
          <MfaStep
            challenge={step.challenge}
            onExpired={(notice) => setStep({ name: "password", notice })}
            onBack={() => setStep({ name: "password" })}
          />
        )}
        {step.name === "forgot" && (
          <ForgotStep
            email={email}
            onEmail={setEmail}
            onBack={() => setStep({ name: "password" })}
          />
        )}
      </BrandCard>
      <Link
        to="/diagnostico"
        className="mx-auto -mt-2 flex min-h-11 items-center gap-2 text-sm text-white/60 active:text-white"
      >
        <Stethoscope className="size-4" aria-hidden="true" />
        Testar este aparelho
      </Link>
    </BrandScreen>
  );
}

interface PasswordStepProps {
  email: string;
  onEmail: (value: string) => void;
  notice?: string;
  onChallenge: (challenge: MfaChallenge) => void;
  onForgot: () => void;
}

function StepTitle({
  icon: Icon,
  title,
  children,
}: {
  icon?: typeof Mail;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 space-y-1 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-[#5b93ff]/15 text-[#8fb4ff]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
      {children && <p className="text-sm text-white/65">{children}</p>}
    </div>
  );
}

function PasswordStep({ email, onEmail, notice, onChallenge, onForgot }: PasswordStepProps) {
  const { completeLogin } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authApi.login(email.trim(), password);
      if (isMfaChallenge(result)) onChallenge(result);
      else await completeLogin(result.access_token);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <StepTitle title="Bem-vindo de volta">Entre com sua conta para atender.</StepTitle>
      <div className="space-y-4">
        <Field
          label="E-mail"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          placeholder="voce@empresa.com"
          required
          leading={<Mail />}
          className={BRAND_INPUT}
          value={email}
          onChange={(event) => onEmail(event.target.value)}
        />
        <div className="space-y-1">
          <Field
            label="Senha"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            leading={<LockKeyhole />}
            className={BRAND_INPUT}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            trailing={
              <button
                type="button"
                className="flex size-11 items-center justify-center text-white/60 active:text-white"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            }
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="min-h-11 text-sm font-medium text-[#8fb4ff] active:text-white"
              onClick={onForgot}
            >
              Esqueci a senha
            </button>
          </div>
        </div>
        <ErrorText className="rounded-xl bg-destructive/10 px-3 py-2">{error}</ErrorText>
        <Button type="submit" block loading={busy} className={BRAND_BUTTON}>
          Entrar
        </Button>
      </div>
    </form>
  );
}

interface MfaStepProps {
  challenge: MfaChallenge;
  onExpired: (notice: string) => void;
  onBack: () => void;
}

function MfaStep({ challenge, onExpired, onBack }: MfaStepProps) {
  const { completeLogin } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(challenge.resend_in);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleError = (caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 410) onExpired(caught.detail);
    else setError(messageOf(caught));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { access_token } = await authApi.confirmMfa(challenge.challenge_id, code.trim());
      await completeLogin(access_token);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const result = await authApi.resendMfa(challenge.challenge_id);
      setResendIn(result.resend_in);
    } catch (caught) {
      handleError(caught);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepTitle icon={ShieldCheck} title="Confirme que é você">
        Enviamos um código para {challenge.email_hint}.
      </StepTitle>
      <Field
        label="Código"
        leading={<KeyRound />}
        className={cn(BRAND_INPUT, "tracking-[0.3em]")}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={16}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block loading={busy} className={BRAND_BUTTON}>
        Confirmar
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="min-h-11 text-white/60" onClick={onBack}>
          Voltar
        </button>
        <button
          type="button"
          className="min-h-11 font-medium text-[#8fb4ff] disabled:text-white/40"
          disabled={resendIn > 0}
          onClick={resend}
        >
          {resendIn > 0 ? `Reenviar em ${resendIn} s` : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}

interface ForgotStepProps {
  email: string;
  onEmail: (value: string) => void;
  onBack: () => void;
}

function ForgotStep({ email, onEmail, onBack }: ForgotStepProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <StepTitle icon={Mail} title="Confira seu e-mail">
          Se esse e-mail tiver conta, você vai receber o link para criar uma nova senha.
        </StepTitle>
        <Button block variant="secondary" onClick={onBack}>
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepTitle icon={KeyRound} title="Recuperar senha">
        Informe seu e-mail e enviaremos um link para criar uma nova senha.
      </StepTitle>
      <Field
        label="E-mail"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        placeholder="voce@empresa.com"
        required
        leading={<Mail />}
        className={BRAND_INPUT}
        value={email}
        onChange={(event) => onEmail(event.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block loading={busy} className={BRAND_BUTTON}>
        Enviar link
      </Button>
      <Button block variant="ghost" onClick={onBack}>
        Voltar
      </Button>
    </form>
  );
}
