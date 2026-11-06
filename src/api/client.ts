import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { ZodType } from "zod";
import { apiUrl } from "@/config/runtimeEnv";
import { getToken, getWorkspaceId } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly body?: unknown
  ) {
    super(detail);
    this.name = "ApiError";
  }

  /** Sem resposta do servidor: rede fora, tempo esgotado. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** Texto para o usuário. O backend devolve `detail` como texto, lista ou objeto. */
export function formatDetail(data: unknown, status: number): string {
  if (typeof data === "string" && data.trim()) return data;
  const detail = (data as { detail?: unknown } | null | undefined)?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => (typeof item === "string" ? item : (item as { msg?: string } | null)?.msg))
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  const message = (detail as { message?: unknown } | null | undefined)?.message;
  if (typeof message === "string") return message;
  return `Erro ${status}`;
}

const http = axios.create({ timeout: 30_000 });

http.interceptors.request.use((config) => {
  config.baseURL = apiUrl();
  const token = getToken();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  const workspace = getWorkspaceId();
  if (workspace) config.headers["X-Company-Id"] = workspace;
  return config;
});

let onUnauthorized: (() => void) | null = null;

/** Registrado pelo AuthProvider: token recusado encerra a sessão local. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const response = (error as AxiosError).response;
  if (!response) return new ApiError(0, "Sem conexão com o servidor. Tente de novo.");
  return new ApiError(response.status, formatDetail(response.data, response.status), response.data);
}

async function call<T>(config: AxiosRequestConfig, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = (await http.request(config)).data;
  } catch (error) {
    const apiError = toApiError(error);
    // Login errado também responde 401, e aí não há sessão para encerrar.
    if (apiError.status === 401 && getToken()) onUnauthorized?.();
    throw apiError;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(
      `[api] resposta inesperada em ${config.method} ${config.url}`,
      parsed.error.issues
    );
    throw new ApiError(502, "O servidor respondeu em um formato inesperado.", data);
  }
  return parsed.data;
}

export const api = {
  get: <T>(url: string, schema: ZodType<T>, params?: Record<string, unknown>) =>
    call({ method: "GET", url, params }, schema),
  post: <T>(url: string, schema: ZodType<T>, body?: unknown, headers?: Record<string, string>) =>
    call({ method: "POST", url, data: body, headers }, schema),
};
