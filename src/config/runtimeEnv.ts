/**
 * Configuração pública. No container vem de `/runtime-config.js`, gerado na subida (a mesma imagem serve em qualquer
 * hospedagem); em desenvolvimento, de `import.meta.env`. Nada aqui é segredo.
 */
export type RuntimeEnvKey = "VITE_API_URL" | "VITE_REALTIME_URL";

type RuntimeConfig = Partial<Record<RuntimeEnvKey, string>>;

declare global {
  interface Window {
    __AG3_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const clean = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
};

export function getRuntimeEnv(key: RuntimeEnvKey): string | undefined {
  return clean(window.__AG3_RUNTIME_CONFIG__?.[key]) ?? clean(import.meta.env[key]);
}

export function apiUrl(): string {
  return (getRuntimeEnv("VITE_API_URL") ?? "").replace(/\/+$/, "");
}

export function realtimeUrl(): string {
  const explicit = getRuntimeEnv("VITE_REALTIME_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  return `${apiUrl().replace(/^http/, "ws")}/ws/realtime`;
}
