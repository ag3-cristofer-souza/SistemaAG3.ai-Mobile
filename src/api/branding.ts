import { z } from "zod";
import { apiUrl } from "@/config/runtimeEnv";

/**
 * Marca do white label (plano de parceiros, onda 7): `GET /branding`, pública. Vai por `fetch` direto, sem o cliente da
 * API: um erro nela não pode derrubar a sessão nem virar aviso; sem marca, o app é o de sempre.
 */
export const brandSchema = z.object({
  is_default: z.boolean(),
  product_name: z.string(),
  slug: z.string().optional(),
  color_primary: z.string().optional(),
  color_primary_dark: z.string().optional(),
  /** Logo para fundo claro. */
  logo_light: z.string().optional(),
  /** Logo para fundo escuro (abertura e entrada). */
  logo_dark: z.string().optional(),
  favicon: z.string().optional(),
  app_icon: z.string().optional(),
  support_email: z.string().optional(),
  support_phone: z.string().optional(),
  support_url: z.string().optional(),
  terms_url: z.string().optional(),
  privacy_url: z.string().optional(),
  addresses: z.object({ painel: z.string(), mobile: z.string(), suporte: z.string() }).optional(),
});

export type Brand = z.infer<typeof brandSchema>;

export const DEFAULT_BRAND: Brand = { is_default: true, product_name: "AG3" };

const base = () => apiUrl().replace(/\/$/, "");

export const brandingApi = {
  /** `host` antes do login (o endereço do app); `slug` depois (a empresa aberta). Falha = marca padrão. */
  fetch: async (params: { host?: string; slug?: string }): Promise<Brand> => {
    if (!apiUrl()) return DEFAULT_BRAND;
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      const resp = await fetch(`${base()}/branding?${query}`, { credentials: "omit" });
      if (!resp.ok) return DEFAULT_BRAND;
      const parsed = z.object({ data: brandSchema }).safeParse(await resp.json());
      return parsed.success ? parsed.data.data : DEFAULT_BRAND;
    } catch {
      return DEFAULT_BRAND;
    }
  },

  /** O manifesto do app com o nome e o ícone do parceiro, servido pela API para este endereço. */
  manifestUrl: (host: string) => `${base()}/branding/manifest?host=${encodeURIComponent(host)}`,
};
