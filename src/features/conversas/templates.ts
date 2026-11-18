import type { ConversationTemplate, MetaWindow } from "@/api/conversations";

/** Template da Meta pela conversa (backend, adendo iu): regras puras da tela. */

export const CATEGORY_LABEL: Record<string, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

/** Chave do template na lista (o mesmo nome pode existir em mais de um idioma). */
export const templateKey = (template: Pick<ConversationTemplate, "name" | "language">) =>
  `${template.name}|${template.language}`;

/** Valores iniciais dos campos: o que o backend já preencheu com os dados do lead. */
export const initialValues = (template: ConversationTemplate): Record<string, string> =>
  Object.fromEntries(template.fields.map((field) => [field.key, field.value]));

/** Prévia com os valores digitados; campo vazio mostra o exemplo ou o marcador. */
export function renderPreview(
  template: ConversationTemplate,
  values: Record<string, string>
): string {
  const byKey = new Map(template.fields.map((field) => [field.key, field]));
  return template.preview_template.replace(/\{\{([^{}]+)\}\}/g, (marker, key: string) => {
    const typed = (values[key] ?? "").trim();
    return typed || byKey.get(key)?.example || marker;
  });
}

/** Rótulos dos campos sem valor (o envio exige todos). */
export const missingFields = (template: ConversationTemplate, values: Record<string, string>) =>
  template.fields.filter((field) => !(values[field.key] ?? "").trim()).map((field) => field.label);

/** Canal oficial com a janela de 24 h fechada: só template passa. */
export const needsTemplate = (window: MetaWindow | null | undefined, now: Date = new Date()) =>
  Boolean(window?.meta) &&
  (!window?.open || !window.expires_at || new Date(window.expires_at) <= now);
