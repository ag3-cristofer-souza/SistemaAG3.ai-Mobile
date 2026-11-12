import { useEffect, type CSSProperties, type ReactNode } from "react";
import logoBranco from "@/assets/logo-branco.png";
import { TERRA_PATH, TERRA_VIEWBOX as v } from "@/features/abertura/terra";

/** O mesmo globo girando da abertura, com halo e anel. */
export function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex size-40 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#2f6bff] opacity-30 blur-3xl"
        />
        <span aria-hidden="true" className="absolute inset-0 rounded-full border border-white/10" />
        <span
          aria-hidden="true"
          className="absolute inset-3 rounded-full border border-white/[0.06]"
        />
        <div className="globo" style={{ "--d": "112px" } as CSSProperties} aria-hidden="true">
          <svg className="globo-mapa" viewBox={`${v.x} ${v.y} ${v.w * 2} ${v.h}`}>
            <path d={TERRA_PATH} />
            <path d={TERRA_PATH} transform={`translate(${v.w} 0)`} />
          </svg>
        </div>
      </div>
      <img src={logoBranco} alt="AG3.AI" width={148} height={34} />
    </div>
  );
}

const BRAND_COLOR = "#12224e";

/** A barra do sistema acompanha a tela enquanto ela estiver aberta. */
function useBrandStatusBar(): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = BRAND_COLOR;
    return () => {
      meta.content = previous;
    };
  }, []);
}

/** Tela da marca: sempre azul-marinho, com o tema escuro, no meio de um app claro. */
export function BrandScreen({ children }: { children: ReactNode }) {
  useBrandStatusBar();
  return (
    <div className="brand-screen dark relative min-h-dvh overflow-y-auto overflow-x-hidden bg-background text-foreground">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <BrandMark />
        {children}
      </main>
    </div>
  );
}

/** Cartão translúcido sobre o fundo da marca. */
export function BrandCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_20px_60px_rgba(0,8,40,0.45)] backdrop-blur-md">
      {children}
    </div>
  );
}

/** Campo e botão principal sobre o fundo da marca. */
export const BRAND_INPUT =
  "border-white/15 bg-white/[0.06] placeholder:text-white/40 focus-visible:border-[#5b93ff] focus-visible:ring-[#5b93ff]/40";
export const BRAND_BUTTON =
  "min-h-12 bg-gradient-to-r from-[#5b93ff] to-[#2563eb] text-base text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] active:from-[#4a85f5] active:to-[#1d4fd0]";
