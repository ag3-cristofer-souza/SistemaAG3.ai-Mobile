import type { ReactNode } from "react";
import globo from "@/assets/globo.svg";
import logoBranco from "@/assets/logo-branco.png";

/** Globo com anel e a marca, como na abertura da landing. */
export function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-36 items-center justify-center rounded-full border-2 border-white/10">
        <img src={globo} alt="" width={108} height={108} />
      </div>
      <img src={logoBranco} alt="AG3.AI" width={148} height={34} />
    </div>
  );
}

/** Tela da marca: sempre azul-marinho, com o tema escuro, independente do tema do aparelho. */
export function BrandScreen({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-dvh overflow-y-auto bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-7 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <BrandMark />
        {children}
      </main>
    </div>
  );
}
