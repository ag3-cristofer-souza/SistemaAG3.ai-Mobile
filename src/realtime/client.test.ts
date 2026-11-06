import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "./client";

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols: string[]
  ) {
    FakeSocket.instances.push(this);
  }

  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }

  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  serverOpen() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  serverSend(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]!;

const clients: RealtimeClient[] = [];

function makeClient(token: string | null = "tok") {
  const client = new RealtimeClient({ url: () => "ws://x/ws/realtime", token: () => token });
  clients.push(client);
  return client;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.destroy());
  setVisibility("visible");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RealtimeClient", () => {
  it("manda o token no subprotocolo e nunca na URL", () => {
    makeClient().connect("c1");
    expect(last().protocols).toEqual(["geon-realtime", "bearer.tok"]);
    expect(last().url).not.toContain("tok");
  });

  it("não conecta sem token", () => {
    makeClient(null).connect("c1");
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("assina a empresa ao abrir e fica online quando o servidor confirma", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    expect(last().sent[0]).toMatchObject({ type: "subscribe", company_id: "c1" });
    expect(client.getState()).toBe("connecting");
    last().serverSend({ type: "subscribed", company_id: "c1" });
    expect(client.getState()).toBe("online");
  });

  it("entrega o evento só a quem escuta aquela tabela", () => {
    const client = makeClient();
    const conversations = vi.fn();
    const messages = vi.fn();
    client.on("conversations", conversations);
    client.on("messages", messages);
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "change", table: "conversations", eventType: "UPDATE" });
    expect(conversations).toHaveBeenCalledTimes(1);
    expect(messages).not.toHaveBeenCalled();
  });

  it("reconecta com espera crescente e pede resync só depois de assinar de novo", () => {
    const client = makeClient();
    const resync = vi.fn();
    client.onResync(resync);
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    expect(resync).not.toHaveBeenCalled();

    last().close(1006);
    expect(client.getState()).toBe("reconnecting");
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    last().serverOpen();
    expect(resync).not.toHaveBeenCalled();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it("não insiste com token recusado", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    last().close(4401);
    expect(client.getState()).toBe("unauthorized");
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("fecha a conexão morta quando o servidor para de responder", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    vi.advanceTimersByTime(75_000);
    expect(client.getState()).toBe("reconnecting");
  });

  it("fecha com a tela escondida e reconecta com resync ao voltar", () => {
    const client = makeClient();
    const resync = vi.fn();
    client.onResync(resync);
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });

    setVisibility("hidden");
    vi.advanceTimersByTime(30_000);
    expect(last().readyState).toBe(3);
    expect(FakeSocket.instances).toHaveLength(1);

    setVisibility("visible");
    expect(FakeSocket.instances).toHaveLength(2);
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it("não fecha se a tela voltar antes do prazo", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    setVisibility("visible");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("não reconecta com a tela escondida se a rede voltar", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "subscribed", company_id: "c1" });
    setVisibility("hidden");
    vi.advanceTimersByTime(30_000);
    window.dispatchEvent(new Event("online"));
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("disconnect encerra sem tentar de novo", () => {
    const client = makeClient();
    client.connect("c1");
    last().serverOpen();
    client.disconnect();
    expect(client.getState()).toBe("idle");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("avisa quando perde o acesso à empresa", () => {
    const client = makeClient();
    const revoked = vi.fn();
    client.onRevoked(revoked);
    client.connect("c1");
    last().serverOpen();
    last().serverSend({ type: "revoked", company_id: "c1" });
    expect(revoked).toHaveBeenCalledWith("c1");
  });
});
