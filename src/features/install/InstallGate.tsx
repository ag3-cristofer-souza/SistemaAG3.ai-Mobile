import { useState } from "react";
import { Outlet } from "react-router-dom";
import { currentPlatform, installSkipped, isStandalone } from "@/lib/pwa";
import { InstallPage } from "./InstallPage";

/**
 * No celular, fora do app instalado, mostra como instalar. Vem antes do login porque, no iPhone, o login feito no
 * navegador pode não passar para o app instalado.
 */
export function InstallGate() {
  const platform = currentPlatform();
  const [skipped, setSkipped] = useState(installSkipped);
  if (platform !== "desktop" && !isStandalone() && !skipped) {
    return <InstallPage platform={platform} onSkip={() => setSkipped(true)} />;
  }
  return <Outlet />;
}
