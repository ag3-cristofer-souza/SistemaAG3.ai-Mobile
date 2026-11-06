import { useEffect, useState } from "react";
import logoBranco from "@/assets/logo-branco.png";
import { markPlayed, readPlayed, shouldPlayAbertura } from "./abertura";
import { TERRA_PATH, TERRA_VIEWBOX as v } from "./terra";

/**
 * A mesma abertura do site (`LP-AG3/src/components/Abertura.tsx`), no azul-marinho do app. Fica por cima enquanto o app
 * carrega e some sozinha pelo CSS em ~1,9 s, mesmo que o JavaScript pare; o fim da animação só a tira da página.
 */
export function Abertura() {
  const [playing, setPlaying] = useState(() =>
    shouldPlayAbertura(
      window.location.pathname,
      readPlayed(),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  );

  useEffect(() => {
    markPlayed();
  }, []);

  if (!playing) return null;
  return (
    <div
      className="abertura"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.animationName === "abertura-sai") setPlaying(false);
      }}
    >
      <div className="abertura-in">
        <div className="abertura-globo">
          <span className="abertura-anel" />
          <div className="globo">
            <svg className="globo-mapa" viewBox={`${v.x} ${v.y} ${v.w * 2} ${v.h}`}>
              <path d={TERRA_PATH} />
              <path d={TERRA_PATH} transform={`translate(${v.w} 0)`} />
            </svg>
          </div>
        </div>
        <img className="abertura-logo" src={logoBranco} alt="" width={150} height={34} />
      </div>
    </div>
  );
}
