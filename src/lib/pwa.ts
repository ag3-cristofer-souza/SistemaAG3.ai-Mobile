import { useSyncExternalStore } from "react";

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPad em modo desktop se identifica como Mac, mas tem toque.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "desktop";
}

export const currentPlatform = (): Platform =>
  detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);

/** Nome do aparelho na lista de sessões. */
export function describeDevice(): string {
  const names = { ios: "iPhone/iPad", android: "Android", desktop: "Computador" };
  const base = names[currentPlatform()];
  return isStandalone() ? `${base}, app instalado` : `${base}, navegador`;
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

// ── Convite de instalação (Android/Chrome). O evento chega cedo, antes de qualquer tela montar. ──
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let promptEvent: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function captureInstallEvents(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    installed = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useCanPromptInstall = () => useSyncExternalStore(subscribe, () => !!promptEvent);
export const useWasInstalled = () => useSyncExternalStore(subscribe, () => installed);

export async function promptInstall(): Promise<void> {
  const event = promptEvent;
  if (!event) return;
  await event.prompt();
  await event.userChoice;
  promptEvent = null;
  notify();
}

// ── "Continuar no navegador" ──
const SKIP_KEY = "ag3.install.skip";

export function installSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function skipInstall(): void {
  try {
    localStorage.setItem(SKIP_KEY, "1");
  } catch {
    // Sem storage, a tela volta a aparecer no próximo acesso.
  }
}
