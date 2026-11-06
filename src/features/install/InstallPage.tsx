import { Download, EllipsisVertical, Share, SquarePlus, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import {
  promptInstall,
  skipInstall,
  useCanPromptInstall,
  useWasInstalled,
  type Platform,
} from "@/lib/pwa";
import { BrandScreen } from "@/ui/brand";
import { Button } from "@/ui/button";

function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-3 rounded-lg border bg-card p-4 text-sm">{children}</ol>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </li>
  );
}

interface InstallPageProps {
  platform: Exclude<Platform, "desktop">;
  onSkip: () => void;
}

export function InstallPage({ platform, onSkip }: InstallPageProps) {
  const canPrompt = useCanPromptInstall();
  const installed = useWasInstalled();
  const isIos = platform === "ios";

  const skip = () => {
    skipInstall();
    onSkip();
  };

  return (
    <BrandScreen>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Instale o AG3 no celular</h1>
        <p className="text-sm text-muted-foreground">
          {isIos
            ? "No iPhone, as notificações só funcionam com o app instalado."
            : "Fica na tela de início e avisa quando chegar uma conversa."}
        </p>
      </div>

      {installed ? (
        <p className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm">
          <Smartphone className="size-5 shrink-0 text-primary" aria-hidden="true" />
          Pronto. Abra o AG3 pelo ícone na tela de início.
        </p>
      ) : isIos ? (
        <Steps>
          <Step n={1}>
            Toque em Compartilhar
            <Share className="size-4 text-primary" aria-label="ícone de compartilhar" />
          </Step>
          <Step n={2}>
            Escolha Adicionar à Tela de Início
            <SquarePlus className="size-4 text-primary" aria-hidden="true" />
          </Step>
          <Step n={3}>Abra o AG3 pelo ícone e entre com sua conta</Step>
        </Steps>
      ) : canPrompt ? (
        <Button block onClick={() => void promptInstall()}>
          <Download aria-hidden="true" />
          Instalar o app
        </Button>
      ) : (
        <Steps>
          <Step n={1}>
            No Chrome, abra o menu
            <EllipsisVertical className="size-4 text-primary" aria-label="ícone de menu" />
          </Step>
          <Step n={2}>Toque em Instalar app ou Adicionar à tela inicial</Step>
          <Step n={3}>Abra o AG3 pelo ícone e entre com sua conta</Step>
        </Steps>
      )}

      <Button block variant="ghost" onClick={skip}>
        Continuar no navegador
      </Button>
    </BrandScreen>
  );
}
