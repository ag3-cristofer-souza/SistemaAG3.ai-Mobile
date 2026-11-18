import { describe, expect, it } from "vitest";
import type { ConversationTemplate } from "@/api/conversations";
import { initialValues, missingFields, needsTemplate, renderPreview } from "./templates";

const template = (over: Partial<ConversationTemplate> = {}): ConversationTemplate => ({
  name: "retomada",
  language: "pt_BR",
  category: "MARKETING",
  header_format: "NONE",
  header_media_url: "",
  footer: "",
  buttons: [],
  fields: [
    { key: "body:1", label: "Texto {{1}}", value: "Ana", example: "" },
    { key: "body:2", label: "Texto {{2}}", value: "", example: "o pedido" },
  ],
  preview: "Oi Ana, posso ajudar com o pedido?",
  preview_template: "Oi {{body:1}}, posso ajudar com {{body:2}}?",
  configured: false,
  sendable: true,
  unavailable_reason: "",
  ...over,
});

describe("templates", () => {
  it("refaz a prévia com o que foi digitado e cai no exemplo", () => {
    const t = template();
    expect(renderPreview(t, initialValues(t))).toBe("Oi Ana, posso ajudar com o pedido?");
    expect(renderPreview(t, { "body:1": "Bia", "body:2": "a entrega" })).toBe(
      "Oi Bia, posso ajudar com a entrega?"
    );
  });

  it("lista os campos vazios", () => {
    const t = template();
    expect(missingFields(t, initialValues(t))).toEqual(["Texto {{2}}"]);
    expect(missingFields(t, { "body:1": "x", "body:2": "y" })).toEqual([]);
  });

  it("só pede template no canal oficial com a janela fechada", () => {
    const now = new Date("2026-11-18T12:00:00");
    const closed = { meta: true, open: false, last_inbound_at: null, expires_at: null };
    const open = {
      meta: true,
      open: true,
      last_inbound_at: null,
      expires_at: "2026-11-18T14:00:00",
    };
    expect(needsTemplate(closed, now)).toBe(true);
    expect(needsTemplate(open, now)).toBe(false);
    expect(needsTemplate(open, new Date("2026-11-18T15:00:00"))).toBe(true);
    expect(needsTemplate({ ...closed, meta: false }, now)).toBe(false);
    expect(needsTemplate(null, now)).toBe(false);
  });
});
