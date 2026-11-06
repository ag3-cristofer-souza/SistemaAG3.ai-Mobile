import { z } from "zod";
import { describeDevice } from "@/lib/pwa";
import { api } from "./client";

const tokenSchema = z.object({ access_token: z.string().min(1) });

const challengeSchema = z.object({
  mfa_required: z.literal(true),
  challenge_id: z.string(),
  email_hint: z.string(),
  code_expires_in: z.number(),
  resend_in: z.number(),
});

export type MfaChallenge = z.infer<typeof challengeSchema>;

const loginSchema = z.union([challengeSchema, tokenSchema]);
export type LoginResult = z.infer<typeof loginSchema>;

export const isMfaChallenge = (result: LoginResult): result is MfaChallenge =>
  "mfa_required" in result;

const meSchema = z.object({
  data: z.object({
    id: z.string(),
    email: z.string().nullable(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable().optional(),
    is_super_admin: z.boolean().optional(),
    workspaces: z
      .array(z.object({ company_id: z.string().nullable(), role: z.string().nullable() }))
      .optional(),
  }),
});

export type Me = z.infer<typeof meSchema>["data"];

/** Pede ao Django uma sessão só deste aparelho, independente do painel e de outros aparelhos. */
const client = () => ({ system: "mobile", device_name: describeDevice() });

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", loginSchema, { email, password, client: client() }),

  /** 400 = código errado; 410 = desafio encerrado, volta para a senha. */
  confirmMfa: (challengeId: string, code: string) =>
    api.post("/auth/login/mfa", tokenSchema, { challenge_id: challengeId, code, client: client() }),

  /** 429 = ainda na espera; 410 = desafio encerrado. */
  resendMfa: (challengeId: string) =>
    api.post(
      "/auth/login/mfa/resend",
      z.object({ code_expires_in: z.number(), resend_in: z.number() }),
      { challenge_id: challengeId }
    ),

  /** Responde sucesso mesmo sem conta, para não revelar quais e-mails existem. */
  forgotPassword: (email: string) =>
    api.post("/auth/password/forgot", z.object({ success: z.boolean() }), { email }),

  /**
   * Encerra só a sessão deste aparelho. O token vai explícito porque a sessão local é apagada logo depois: o interceptor
   * do cliente HTTP roda de forma assíncrona e já não o encontraria.
   */
  logout: (token: string) =>
    api.post(
      "/auth/logout",
      z.object({ success: z.boolean() }),
      {},
      { Authorization: `Bearer ${token}` }
    ),

  me: async (): Promise<Me> => (await api.get("/auth/me", meSchema)).data,
};
