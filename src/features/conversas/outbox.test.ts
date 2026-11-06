import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { Message } from "@/api/conversations";
import { availableActions, requiresAssume } from "./actions";
import { Outbox, pendingBubbles, retryDelay, toLocalMessage, type OutboxTransport } from "./outbox";

const NETWORK = new ApiError(0, "Sem conexão");
const SAVED: Message = { id: "m1", created_at: "2026-11-06T12:00:00Z", body: "oi" };

function setup(overrides: Partial<OutboxTransport> = {}) {
  const transport = {
    upload: vi.fn(async () => "https://cdn/arquivo"),
    send: vi.fn(async () => SAVED),
    attachQuote: vi.fn(async () => undefined),
    ...overrides,
  };
  const box = new Outbox(transport, async () => undefined);
  const delivered = vi.fn();
  box.onDelivered(delivered);
  return { box, transport, delivered };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
});

describe("quando repetir", () => {
  it("repete em falha de rede e erro do servidor, com limite", () => {
    expect(retryDelay(NETWORK, 0)).toBe(1_000);
    expect(retryDelay(new ApiError(503, "x"), 2)).toBe(7_000);
    expect(retryDelay(NETWORK, 3)).toBeNull();
  });

  it("não repete erro de negócio", () => {
    expect(retryDelay(new ApiError(400, "Fora da janela de 24 horas"), 0)).toBeNull();
    expect(retryDelay(new ApiError(404, "x"), 0)).toBeNull();
    expect(retryDelay(new Error("x"), 0)).toBeNull();
  });

  it("espera quando o mesmo envio ainda está em andamento", () => {
    const busy = new ApiError(409, "x", {
      detail: { code: "SEND_IN_PROGRESS", retry_after_ms: 500 },
    });
    expect(retryDelay(busy, 0)).toBe(500);
    expect(retryDelay(busy, 6)).toBeNull();
    expect(retryDelay(new ApiError(409, "x", { detail: { code: "OUTRO" } }), 0)).toBeNull();
  });
});

describe("envio", () => {
  it("mostra na hora e, ao confirmar, entrega a mensagem e tira a bolha", async () => {
    const { box, transport, delivered } = setup();
    box.add("c1", { kind: "text", text: "oi" });
    expect(box.snapshot("c1")).toHaveLength(1);
    await flush();
    expect(box.snapshot("c1")).toEqual([]);
    expect(delivered).toHaveBeenCalledWith("c1", SAVED);
    expect(vi.mocked(transport.send).mock.calls[0]).toMatchObject([
      "c1",
      { message: "oi", message_type: "text" },
    ]);
  });

  it("resposta perdida: repete com o MESMO id, e o servidor não reenvia", async () => {
    const send = vi
      .fn<OutboxTransport["send"]>()
      .mockRejectedValueOnce(NETWORK)
      .mockResolvedValue(SAVED);
    const { box, delivered } = setup({ send });
    box.add("c1", { kind: "text", text: "oi" });
    await flush();
    await flush();
    const ids = send.mock.calls.map(([, body]) => body.client_message_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it("erro de negócio mostra o texto do servidor e só repete a pedido, com o mesmo id", async () => {
    const send = vi
      .fn<OutboxTransport["send"]>()
      .mockRejectedValueOnce(new ApiError(400, "Fora da janela de 24 horas"))
      .mockResolvedValue(SAVED);
    const { box, delivered } = setup({ send });
    const { clientId } = box.add("c1", { kind: "text", text: "oi" });
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(box.snapshot("c1")[0]).toMatchObject({
      status: "failed",
      error: "Fora da janela de 24 horas",
    });

    box.retry(clientId);
    await flush();
    expect(send.mock.calls[1]![1].client_message_id).toBe(clientId);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it("ao repetir, não sobe de novo o arquivo que já subiu", async () => {
    const send = vi
      .fn<OutboxTransport["send"]>()
      .mockRejectedValueOnce(new ApiError(400, "x"))
      .mockResolvedValue(SAVED);
    const { box, transport } = setup({ send });
    const file = new Blob(["a"], { type: "audio/ogg" });
    const { clientId } = box.add("c1", {
      kind: "audio",
      text: "",
      file,
      fileName: "a.ogg",
      mimeType: "audio/ogg",
    });
    await flush();
    box.retry(clientId);
    await flush();
    expect(transport.upload).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[1]![1].media_url).toBe("https://cdn/arquivo");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa");
  });

  it("citação com id do provedor é nativa; sem ele, vai no texto", async () => {
    const { box, transport } = setup();
    const quote = { author: "Ana", text: "bom dia", messageId: "m0" };
    box.add("c1", { kind: "text", text: "resposta", quote });
    box.add("c1", { kind: "text", text: "resposta", quote: { ...quote, providerId: "Z1" } });
    await flush();
    expect(vi.mocked(transport.send).mock.calls[0]![1].message).toBe(
      "> *Ana*: bom dia\n\nresposta"
    );
    expect(vi.mocked(transport.send).mock.calls[1]![1]).toMatchObject({
      message: "resposta",
      quoted_message_id: "Z1",
    });
    expect(transport.attachQuote).toHaveBeenCalledWith("m1", {
      payload: expect.objectContaining({ quoted_message_id: "m0", quoted_author: "Ana" }),
    });
  });

  it("descartar e sair da conta tiram a bolha", async () => {
    const send = vi.fn<OutboxTransport["send"]>().mockRejectedValue(new ApiError(400, "x"));
    const { box } = setup({ send });
    const { clientId } = box.add("c1", { kind: "text", text: "a" });
    box.add("c2", { kind: "text", text: "b" });
    await flush();
    box.discard(clientId);
    expect(box.snapshot("c1")).toEqual([]);
    box.clear();
    expect(box.snapshot("c2")).toEqual([]);
  });
});

describe("bolha local e mensagem que chegou pelo WebSocket", () => {
  const server = (id: string, body: string, created_at = "2026-11-06T12:00:30Z"): Message => ({
    id,
    body,
    sender_type: "agent",
    created_at,
  });
  const item = (text: string, status: "sending" | "failed" = "sending") => ({
    clientId: text,
    conversationId: "c1",
    draft: { kind: "text" as const, text },
    status,
    createdAt: "2026-11-06T12:00:00Z",
  });

  it("não mostra duas vezes", () => {
    expect(pendingBubbles([item("oi")], [server("m1", "oi")])).toEqual([]);
    expect(pendingBubbles([item("oi")], [server("m1", "outra")])).toHaveLength(1);
  });

  it("cada mensagem do servidor cobre uma bolha só", () => {
    const items = [item("oi"), { ...item("oi"), clientId: "b" }];
    expect(pendingBubbles(items, [server("m1", "oi")])).toHaveLength(1);
  });

  it("mensagem antiga igual não esconde a nova, e falha continua visível", () => {
    expect(pendingBubbles([item("oi")], [server("m1", "oi", "2026-11-06T11:00:00Z")])).toHaveLength(
      1
    );
    expect(pendingBubbles([item("oi", "failed")], [server("m1", "oi")])).toHaveLength(1);
  });

  it("a bolha local tem o estado de envio", () => {
    expect(toLocalMessage(item("oi"))).toMatchObject({
      direction: "out",
      delivery_status: "sending",
      body: "oi",
    });
    expect(toLocalMessage(item("oi", "failed")).delivery_status).toBe("failed");
  });
});

describe("ações do chat", () => {
  it("espera e retomar dependem do status", () => {
    expect(availableActions({ id: "c", status: "in_attendance" }).hold).toBe(true);
    expect(availableActions({ id: "c", status: "in_attendance" }).resume).toBe(false);
    expect(availableActions({ id: "c", status: "on_hold" }).resume).toBe(true);
  });

  it("devolver à fila exige dono; finalizada não tem ações; grupo também não", () => {
    expect(availableActions({ id: "c", status: "pending" }).returnToQueue).toBe(false);
    expect(
      availableActions({ id: "c", status: "pending", assigned_agent_id: "u" }).returnToQueue
    ).toBe(true);
    expect(availableActions({ id: "c", status: "finished", assigned_agent_id: "u" })).toEqual({
      hold: false,
      resume: false,
      transfer: false,
      returnToQueue: false,
      finish: false,
    });
    expect(availableActions({ id: "c", status: "in_attendance", is_group: true }).finish).toBe(
      false
    );
  });

  it("pendente e com a IA pedem para assumir; grupo não", () => {
    expect(requiresAssume({ id: "c", status: "pending" })).toBe(true);
    expect(requiresAssume({ id: "c", status: "qualification_in_progress" })).toBe(true);
    expect(requiresAssume({ id: "c", status: "in_attendance" })).toBe(false);
    expect(requiresAssume({ id: "c", status: "pending", is_group: true })).toBe(false);
  });
});
