import { expect, test, type Page } from "@playwright/test";

const API = "https://api.teste.invalid";

const ME = {
  id: "u1",
  email: "pessoa@empresa.test",
  full_name: "Pessoa Teste",
  avatar_url: null,
  is_super_admin: false,
};

interface MockOptions {
  role?: string;
  mfa?: boolean;
  workspaces?: Array<{ company_id: string; company_name: string; is_primary: boolean }>;
  /** O backend emite sessão própria do aparelho (`ag3s_`), em vez do token compartilhado do painel. */
  sessionToken?: boolean;
  conversations?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  /** Conversas que o servidor responde com 404, como faz com a de outro operador. */
  denied?: Set<string>;
  live?: Record<string, unknown>;
}

const CONV = {
  id: "conv-1",
  status: "in_attendance",
  participant_name: "Maria Cliente",
  participant_phone: "5511999990000",
  is_group: false,
  assigned_agent_id: "u1",
  agent_name: "Pessoa Teste",
  unread_count: 2,
  last_message: "Tudo bem?",
  last_message_at: "2026-11-06T12:00:00Z",
};

const MSG = {
  id: "m1",
  conversation_id: "conv-1",
  direction: "in",
  sender_type: "user",
  message_type: "text",
  body: "Bom dia, preciso de ajuda",
  created_at: "2026-11-06T11:59:00Z",
};

const LIVE = {
  as_of: "2026-11-06T12:00:00Z",
  queue: {
    unassigned: 4,
    oldest_wait_seconds: 720,
    pending: 6,
    in_attendance: 9,
    on_hold: 1,
    with_ai: 3,
  },
  operators: [
    {
      user_id: "o1",
      name: "Otto Offline",
      online: false,
      systems: [],
      active: 0,
      in_attendance: 0,
      on_hold: 0,
      limit: null,
    },
    {
      user_id: "o2",
      name: "Olga Online",
      online: true,
      systems: ["mobile", "painel"],
      active: 5,
      in_attendance: 2,
      on_hold: 1,
      limit: 5,
    },
  ],
  channels: {
    connected: 2,
    disconnected: [{ id: "i1", name: "Canal Vendas", number: "5511900000000" }],
  },
};

/** Simula o backend. Devolve as mensagens que o cliente mandou pelo WebSocket. */
async function mockBackend(page: Page, options: MockOptions = {}) {
  const { role = "operator", mfa = false, sessionToken = false } = options;
  const token = sessionToken ? "ag3s_teste" : "tok";
  const workspaces = options.workspaces ?? [
    { company_id: "c1", company_name: "Empresa Um", is_primary: true },
  ];
  let savedCount = 0;
  const notes: unknown[] = [];
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
    body: JSON.stringify(body),
  });
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill(json({}));
    if (path === "/auth/login") {
      const body = request.postDataJSON() as { password: string };
      if (body.password !== "certa") {
        return route.fulfill(json({ detail: "E-mail ou senha inválidos." }, 401));
      }
      return route.fulfill(
        json(
          mfa
            ? {
                mfa_required: true,
                challenge_id: "d1",
                email_hint: "p***@empresa.test",
                code_expires_in: 600,
                resend_in: 30,
              }
            : { access_token: token, token_type: "bearer", expires_in: 100, user: ME }
        )
      );
    }
    if (path === "/auth/login/mfa") {
      const body = request.postDataJSON() as { code: string };
      if (body.code !== "123456") return route.fulfill(json({ detail: "Código incorreto." }, 400));
      return route.fulfill(json({ access_token: token, token_type: "bearer", user: ME }));
    }
    if (path === "/auth/me") {
      if (request.headers().authorization !== `Bearer ${token}`) {
        return route.fulfill(json({ detail: "Token inválido" }, 401));
      }
      return route.fulfill(
        json({
          data: { ...ME, workspaces: workspaces.map((w) => ({ company_id: w.company_id, role })) },
        })
      );
    }
    if (path === "/users/workspaces") return route.fulfill(json({ data: workspaces }));
    if (path === "/auth/logout") return route.fulfill(json({ success: true }));
    if (path === "/dashboard/live") return route.fulfill(json({ data: options.live ?? LIVE }));
    if (path === "/conversations/counts") {
      return route.fulfill(
        json({
          data: { ia: 0, pending: 3, groups: 0, all: 0, mine: 1, on_hold: 0, finished: 0 },
        })
      );
    }
    if (path === "/conversations") {
      return route.fulfill(json({ data: options.conversations ?? [], page: 1, limit: 30 }));
    }
    if (path === "/conversations/agent-limit") {
      return route.fulfill(
        json({ data: { limit: 5, active_count: 1, is_at_limit: false, is_unlimited: false } })
      );
    }
    if (path === "/users/workspace-roster") {
      return route.fulfill(
        json({
          data: [
            { id: "u1", full_name: "Pessoa Teste", avatar_url: null },
            { id: "u2", full_name: "Olga Operadora", avatar_url: null },
          ],
        })
      );
    }
    if (path.startsWith("/conversations/messages/")) return route.fulfill(json({ data: {} }));
    const chat = path.match(/^\/conversations\/([^/]+)(\/.*)?$/);
    if (chat) {
      if (options.denied?.has(chat[1]!)) {
        return route.fulfill(json({ detail: "Conversa nao encontrada" }, 404));
      }
      if (chat[2] === "/messages") {
        return route.fulfill(json({ data: options.messages ?? [], page: 1, limit: 50 }));
      }
      if (chat[2] === "/send-message") {
        const body = request.postDataJSON() as { message: string; message_type: string };
        return route.fulfill(
          json({
            data: {
              ...MSG,
              id: `salva-${++savedCount}`,
              direction: "out",
              sender_type: "agent",
              body: body.message,
              message_type: body.message_type,
              delivery_status: "sent",
              created_at: new Date().toISOString(),
            },
            provider_message_id: "PROV-1",
          })
        );
      }
      if (chat[2] === "/media") {
        return route.fulfill(json({ data: { url: "https://cdn.teste.invalid/arquivo" } }));
      }
      if (chat[2] === "/notes") {
        if (request.method() === "POST") {
          const note = {
            id: "n1",
            content: (request.postDataJSON() as { content: string }).content,
            created_by: "u1",
            created_at: "2026-11-06T12:00:00Z",
          };
          notes.push(note);
          return route.fulfill(json({ data: note }));
        }
        return route.fulfill(json({ data: notes }));
      }
      if (chat[2]) return route.fulfill(json({ data: {} }));
      const found = (options.conversations ?? []).find((item) => item.id === chat[1]);
      return route.fulfill(found ? json({ data: found }) : json({ detail: "x" }, 404));
    }
    return route.fulfill(json({ detail: "não simulado" }, 404));
  });

  const sockets: Array<{
    protocols: string | null;
    sent: Record<string, unknown>[];
    push: (message: unknown) => void;
  }> = [];
  await page.routeWebSocket(/\/ws\/realtime/, (ws) => {
    const entry = {
      protocols: ws.url() ? "aberto" : null,
      sent: [] as Record<string, unknown>[],
      push: (message: unknown) => ws.send(JSON.stringify(message)),
    };
    sockets.push(entry);
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as Record<string, unknown>;
      entry.sent.push(message);
      if (message.type === "subscribe") {
        ws.send(JSON.stringify({ type: "subscribed", company_id: message.company_id, tables: [] }));
      }
      if (message.type === "focus") {
        ws.send(
          JSON.stringify({
            type: "focused",
            conversation_id: message.conversation_id,
            company_id: "c1",
          })
        );
      }
    });
    ws.send(JSON.stringify({ type: "ready", user_id: "u1" }));
  });
  return sockets;
}

async function passInstallGate(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Instale o AG3 no celular" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar no navegador" }).click();
}

async function login(page: Page, password = "certa") {
  await page.getByLabel("E-mail").fill("pessoa@empresa.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("a abertura toca antes do login, some sozinha e não repete na mesma sessão", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockBackend(page);
  await page.addInitScript(() => localStorage.setItem("ag3.install.skip", "1"));
  await page.goto("/");
  await expect(page.locator(".abertura")).toBeVisible();
  await expect(page.locator(".abertura .globo")).toBeVisible();
  await expect(page.locator(".abertura")).toHaveCount(0, { timeout: 5_000 });
  await page.getByLabel("E-mail").fill("pessoa@empresa.test");
  await page.reload();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.locator(".abertura")).toHaveCount(0);
});

test("conversa aberta por link não espera a abertura", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/conversas/conv-1");
  await expect(page.getByText("Bom dia, preciso de ajuda")).toBeVisible();
  await expect(page.locator(".abertura")).toHaveCount(0);
});

test("no celular, mostra como instalar e lembra quem prefere o navegador", async ({ page }) => {
  await mockBackend(page);
  await passInstallGate(page);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("senha errada mostra o erro do servidor e continua no login", async ({ page }) => {
  await mockBackend(page);
  await passInstallGate(page);
  await login(page, "errada");
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
});

test("operador entra em Conversas, sem a aba Agora, e assina a empresa em tempo real", async ({
  page,
}) => {
  const sockets = await mockBackend(page, { role: "operator" });
  await passInstallGate(page);
  await login(page);
  await expect(page).toHaveURL(/\/conversas$/);
  await expect(page.getByRole("heading", { name: "Empresa Um" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agora" })).toHaveCount(0);
  await expect(page.getByText("Ao vivo")).toBeVisible();
  expect(sockets.at(-1)?.sent[0]).toMatchObject({ type: "subscribe", company_id: "c1" });

  await page.goto("/agora");
  await expect(page).toHaveURL(/\/conversas$/);
});

test("gestor entra em Agora e vê as três abas", async ({ page }) => {
  await mockBackend(page, { role: "manager" });
  await passInstallGate(page);
  await login(page);
  await expect(page).toHaveURL(/\/agora$/);
  for (const name of ["Agora", "Conversas", "Conta"]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
});

test("gestor vê os números do momento em Agora", async ({ page }) => {
  await mockBackend(page, { role: "manager" });
  await passInstallGate(page);
  await login(page);
  await expect(page.getByText("Fila sem dono")).toBeVisible();
  await expect(page.getByText("Maior espera: 12 min")).toBeVisible();
  await expect(page.getByText("Canal Vendas")).toBeVisible();
  await expect(page.getByText("Desconectado")).toBeVisible();
  await expect(page.getByText("Equipe: 1 online de 2")).toBeVisible();
  // Quem está online vem primeiro, com os sistemas em que está.
  await expect(page.getByRole("listitem").filter({ hasText: "Olga" })).toContainText(
    "App e Painel"
  );
  await expect(page.getByRole("meter", { name: "Fila de Olga Online" })).toHaveAttribute(
    "aria-valuenow",
    "5"
  );
  await expect(page.getByText("No limite")).toBeVisible();
  await expect(page.getByText(/Atualizado há/)).toBeVisible();
});

test("operador vê as abas dele e a API recebe o filtro de cada uma", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV] });
  const requests: URLSearchParams[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/conversations" && request.method() === "GET") {
      requests.push(url.searchParams);
    }
  });
  await passInstallGate(page);
  await login(page);
  await expect(page.getByRole("link", { name: /Maria Cliente/ })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText([
    "Pendentes3",
    "Minhas1",
    "Em espera",
    "Grupos",
    "Finalizadas",
  ]);
  expect(requests.at(-1)?.get("status")).toBe("pending");
  expect(requests.at(-1)?.get("assigned_agent_id")).toBe("u1");

  await page.getByRole("tab", { name: "Grupos" }).click();
  await expect.poll(() => requests.at(-1)?.get("is_group")).toBe("true");
  expect(requests.at(-1)?.get("assigned_agent_id")).toBeNull();
  await expect(page).toHaveURL(/aba=groups/);

  await page.getByLabel("Buscar conversas").fill("maria");
  await expect.poll(() => requests.at(-1)?.get("search")).toBe("maria");
});

test("rolar uma lista longa move só a lista, sem subir a página inteira", async ({ page }) => {
  const conversations = Array.from({ length: 30 }, (_, index) => ({
    ...CONV,
    id: `conv-${index}`,
    participant_name: `Cliente ${index}`,
  }));
  await mockBackend(page, { conversations });
  await passInstallGate(page);
  await login(page);
  await expect(page.getByRole("link", { name: "Cliente 29" })).toBeAttached();
  await page.getByRole("button", { name: "Carregar mais" }).scrollIntoViewIfNeeded();
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(200);
  const page_ = await page.evaluate(() => ({
    scrollY: window.scrollY,
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  expect(page_.scrollY).toBe(0);
  expect(page_.height).toBeLessThanOrEqual(page_.viewport);
  await expect(page.getByRole("navigation", { name: "Principal" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Empresa Um" })).toBeInViewport();
});

test("chat abre com histórico, marca como lido e recebe mensagem nova da conversa em foco", async ({
  page,
}) => {
  const sockets = await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  const read = page.waitForRequest((r) => r.url().endsWith("/conv-1/reset-unread"));
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: /Maria Cliente/ }).click();
  await expect(page).toHaveURL(/\/conversas\/conv-1$/);
  await expect(page.getByRole("heading", { name: "Maria Cliente" })).toBeVisible();
  await expect(page.getByText("Bom dia, preciso de ajuda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Conversas" })).toHaveCount(0);
  await read;

  const socket = sockets.at(-1)!;
  await expect
    .poll(() => socket.sent.find((m) => m.type === "focus"))
    .toEqual({ type: "focus", conversation_id: "conv-1" });

  const event = (id: string, conversation: string, body: string) => ({
    type: "change",
    table: "messages",
    eventType: "INSERT",
    company_id: "c1",
    id,
    new: { ...MSG, id, conversation_id: conversation, body, created_at: "2026-11-06T12:05:00Z" },
    old: null,
  });
  socket.push(event("m2", "outra", "de outra conversa"));
  socket.push(event("m3", "conv-1", "chegou agora"));
  await expect(page.getByText("chegou agora")).toBeVisible();
  await expect(page.getByText("de outra conversa")).toHaveCount(0);

  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/conversas$/);
  await expect
    .poll(() => socket.sent.filter((m) => m.type === "focus").at(-1))
    .toEqual({ type: "focus", conversation_id: null });
});

/** Abre o chat direto, já logado, e devolve os pedidos de envio que o app fizer. */
async function openChat(page: Page, conversation: Record<string, unknown> = CONV) {
  const sends: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/send-message")) sends.push(request.postDataJSON());
  });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto(`/conversas/${String(conversation.id)}`);
  return sends;
}

test("enviar mostra a bolha na hora e manda o id que evita duplicar", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  const sends = await openChat(page);
  await page.getByRole("textbox", { name: "Mensagem" }).fill("Posso ajudar sim");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Posso ajudar sim")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Mensagem" })).toHaveValue("");
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toMatchObject({ message: "Posso ajudar sim", message_type: "text" });
  expect(String(sends[0]!.client_message_id)).toMatch(/^[0-9a-f]{32}$/);
  await expect(page.getByRole("img", { name: "Enviada" })).toBeVisible();
});

test("conexão caiu no envio: repete sozinho com o mesmo id e mostra uma bolha só", async ({
  page,
}) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  let attempts = 0;
  await page.route(`${API}/conversations/conv-1/send-message`, (route) => {
    attempts += 1;
    return attempts === 1 ? route.abort("connectionreset") : route.fallback();
  });
  const sends = await openChat(page);
  await page.getByRole("textbox", { name: "Mensagem" }).fill("Mensagem em rede ruim");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("img", { name: "Enviando" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Enviada" })).toBeVisible({ timeout: 10_000 });
  expect(sends).toHaveLength(2);
  expect(sends[0]!.client_message_id).toBe(sends[1]!.client_message_id);
  await expect(page.getByText("Mensagem em rede ruim")).toHaveCount(1);
});

test("recusa do servidor mostra o motivo, não repete sozinho e deixa tentar de novo", async ({
  page,
}) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  let refuse = true;
  await page.route(`${API}/conversations/conv-1/send-message`, (route) =>
    refuse
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ detail: "Fora da janela de 24 horas do WhatsApp Meta." }),
        })
      : route.fallback()
  );
  const sends = await openChat(page);
  await page.getByRole("textbox", { name: "Mensagem" }).fill("Fora da janela");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Fora da janela de 24 horas do WhatsApp Meta.");
  expect(sends).toHaveLength(1);
  refuse = false;
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("img", { name: "Enviada" })).toBeVisible();
  expect(sends[1]!.client_message_id).toBe(sends[0]!.client_message_id);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("conversa pendente pede para assumir antes de responder", async ({ page }) => {
  const pending = { ...CONV, status: "pending", assigned_agent_id: null, agent_name: null };
  await mockBackend(page, { conversations: [pending], messages: [MSG] });
  const assign = page.waitForRequest((r) => r.url().endsWith("/conv-1/assign"));
  await openChat(page, pending);
  await expect(page.getByRole("textbox", { name: "Mensagem" })).toHaveCount(0);
  await page.getByRole("button", { name: "Assumir e responder" }).click();
  expect((await assign).postDataJSON()).toEqual({ agent_id: "u1", assignment_type: "from_queue" });
  await expect(page.getByRole("textbox", { name: "Mensagem" })).toBeVisible();
});

test("responder cita a mensagem com o id do provedor", async ({ page }) => {
  await mockBackend(page, {
    conversations: [CONV],
    messages: [{ ...MSG, z_api_message_id: "ZAPI-1" }],
  });
  const sends = await openChat(page);
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Respondendo a Maria Cliente")).toBeVisible();
  const patch = page.waitForRequest((r) => r.method() === "PATCH");
  await page.getByRole("textbox", { name: "Mensagem" }).fill("Claro");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toMatchObject({ message: "Claro", quoted_message_id: "ZAPI-1" });
  expect((await patch).postDataJSON().payload).toMatchObject({
    quoted_message_id: "m1",
    quoted_author: "Maria Cliente",
  });
  await expect(page.getByText("Respondendo a")).toHaveCount(0);
});

test("anexar documento sobe o arquivo e envia o link", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  const sends = await openChat(page);
  await page.getByRole("button", { name: "Anexar" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Documento" }).click();
  const upload = page.waitForRequest((r) => r.url().endsWith("/conv-1/media"));
  await (
    await chooser
  ).setFiles({
    name: "pedido.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  expect((await upload).postData()).toContain('filename="pedido.pdf"');
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toMatchObject({
    message_type: "document",
    media_url: "https://cdn.teste.invalid/arquivo",
  });
});

test("gravar áudio envia um ogg como áudio", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  const sends = await openChat(page);
  await page.getByRole("button", { name: "Gravar áudio" }).click();
  await expect(page.getByText(/Gravando/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  const upload = page.waitForRequest((r) => r.url().endsWith("/conv-1/media"));
  await page.getByRole("button", { name: "Enviar áudio" }).click();
  const body = (await upload).postDataBuffer()?.toString("latin1") ?? "";
  expect(body).toContain("Content-Type: audio/ogg");
  expect(body).toContain("OggS");
  await expect.poll(() => sends.length, { timeout: 10_000 }).toBe(1);
  expect(sends[0]).toMatchObject({ message_type: "audio", message: "" });
});

test("ações: espera, anotação, transferência com motivo e finalizar com confirmação", async ({
  page,
}) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  await openChat(page);
  const menu = page.getByRole("button", { name: "Mais ações" });

  const hold = page.waitForRequest((r) => r.url().endsWith("/conv-1/hold"));
  await menu.click();
  await page.getByRole("button", { name: "Colocar em espera" }).click();
  await hold;
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await menu.click();
  await page.getByRole("button", { name: "Anotações internas" }).click();
  await page.getByLabel("Nova anotação").fill("Cliente prefere à tarde");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cliente prefere à tarde" })
  ).toContainText("Pessoa Teste");
  await page.getByRole("button", { name: "Fechar" }).click();

  await menu.click();
  await page.getByRole("button", { name: "Transferir" }).click();
  await expect(page.getByRole("button", { name: "Transferir", exact: true })).toBeDisabled();
  await page.getByLabel("Transferir para").selectOption("u2");
  await expect(page.getByLabel("Transferir para").locator("option")).toHaveText([
    "Selecione",
    "Olga Operadora",
  ]);
  await page.getByLabel("Motivo").fill("Saindo de férias");
  await page.getByRole("button", { name: "Fechar" }).click();

  const finish = page.waitForRequest((r) => r.url().endsWith("/conv-1/finish"));
  await menu.click();
  await page.getByRole("button", { name: "Finalizar atendimento" }).click();
  await expect(page.getByText("sairá da sua fila")).toBeVisible();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await finish;
  await expect(page).toHaveURL(/\/conversas$/);
});

test("transferir envia destino e motivo e volta para a lista", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  await openChat(page);
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Transferir" }).click();
  await page.getByLabel("Transferir para").selectOption("u2");
  await page.getByLabel("Motivo").fill("Saindo de férias");
  const transfer = page.waitForRequest((r) => r.url().endsWith("/conv-1/transfer"));
  await page.getByRole("button", { name: "Transferir", exact: true }).click();
  expect((await transfer).postDataJSON()).toEqual({
    to_agent_id: "u2",
    transfer_note: "Saindo de férias",
  });
  await expect(page).toHaveURL(/\/conversas$/);
});

test("conversa fora do alcance aparece como indisponível, inclusive por link", async ({ page }) => {
  await mockBackend(page, { denied: new Set(["alheia"]) });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/conversas/alheia");
  await expect(page.getByRole("heading", { name: "Conversa indisponível" })).toBeVisible();
  await expect(page.getByText("Bom dia")).toHaveCount(0);
});

test("ao perder o acesso com o chat aberto, a conversa some da tela", async ({ page }) => {
  const denied = new Set<string>();
  const sockets = await mockBackend(page, { conversations: [CONV], messages: [MSG], denied });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/conversas/conv-1");
  await expect(page.getByText("Bom dia, preciso de ajuda")).toBeVisible();
  await expect.poll(() => sockets.at(-1)?.sent.some((m) => m.type === "focus")).toBe(true);
  denied.add("conv-1");
  sockets.at(-1)!.push({ type: "unfocused", conversation_id: "conv-1", reason: "revoked" });
  await expect(page.getByRole("heading", { name: "Conversa indisponível" })).toBeVisible();
  await expect(page.getByText("Bom dia, preciso de ajuda")).toHaveCount(0);
});

test("login com código em duas etapas", async ({ page }) => {
  await mockBackend(page, { mfa: true });
  await passInstallGate(page);
  await login(page);
  await expect(page.getByText("p***@empresa.test")).toBeVisible();
  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Código incorreto.");
  await page.getByLabel("Código").fill("123456");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/conversas$/);
});

test("com token compartilhado do painel, sair não chama o logout do servidor", async ({ page }) => {
  await mockBackend(page);
  let logoutCalls = 0;
  await page.route(`${API}/auth/logout`, (route) => {
    logoutCalls += 1;
    return route.fulfill({ status: 200, body: "{}" });
  });
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: "Conta" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(logoutCalls).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("ag3.token"))).toBeNull();
});

test("o login pede sessão própria e sair encerra só a sessão deste aparelho", async ({ page }) => {
  await mockBackend(page, { sessionToken: true });
  let loginBody: { client?: { system?: string; device_name?: string } } = {};
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/login") && request.method() === "POST") {
      loginBody = request.postDataJSON();
    }
  });
  const logout = page.waitForRequest(
    (r) => r.url().endsWith("/auth/logout") && r.method() === "POST"
  );
  await passInstallGate(page);
  await login(page);
  await expect(page).toHaveURL(/\/conversas$/);
  expect(loginBody.client?.system).toBe("mobile");
  expect(loginBody.client?.device_name).toContain("Android");
  await page.getByRole("link", { name: "Conta" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  expect((await logout).headers().authorization).toBe("Bearer ag3s_teste");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ag3.token"))).toBeNull();
});

test("token recusado volta para o login", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "vencido");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("troca de empresa muda o que aparece", async ({ page }) => {
  await mockBackend(page, {
    role: "admin",
    workspaces: [
      { company_id: "c1", company_name: "Empresa Um", is_primary: true },
      { company_id: "c2", company_name: "Empresa Dois", is_primary: false },
    ],
  });
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: "Conta" }).click();
  await page.getByLabel("Empresa").selectOption("c2");
  await expect(page.getByRole("heading", { name: "Empresa Dois" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ag3.workspace"))).toBe("c2");
});

test("service worker ativa e guarda o app para abrir sem conexão", async ({ page, context }) => {
  await mockBackend(page);
  await passInstallGate(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await context.setOffline(false);
});

test("diagnóstico grava um arquivo ogg de verdade", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.setItem("ag3.install.skip", "1"));
  await page.goto("/diagnostico");
  await page.getByRole("button", { name: "Gravar" }).click();
  const stop = page.getByRole("button", { name: "Parar" });
  await expect(stop).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await stop.click();
  const size = page.getByText(/Gravado em ogg: \d/);
  await expect(size).toBeVisible({ timeout: 15_000 });
  const header = await page.evaluate(async () => {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    const buffer = await (await fetch(audio.src)).arrayBuffer();
    return String.fromCharCode(...new Uint8Array(buffer).slice(0, 4));
  });
  expect(header).toBe("OggS");
});

test("diagnóstico dispara notificação local pelo service worker", async ({ page, context }) => {
  await mockBackend(page);
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => localStorage.setItem("ag3.install.skip", "1"));
  await page.goto("/diagnostico");
  await page.getByRole("button", { name: "Enviar notificação de teste" }).click();
  await expect(page.getByText("Notificação enviada.", { exact: false })).toBeVisible();
  const titles = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.getNotifications()).map((item) => item.title);
  });
  expect(titles).toContain("AG3");
});

test("sem Firebase configurado no Django, o diagnóstico explica e o app segue funcionando", async ({
  page,
  context,
}) => {
  await mockBackend(page);
  await context.grantPermissions(["notifications"]);
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: "Conta" }).click();
  await page.getByRole("link", { name: "Testar este aparelho" }).click();
  await page.getByRole("button", { name: "Registrar para notificação remota" }).click();
  await expect(page.getByText("ainda não foram configuradas no servidor")).toBeVisible();
  await expect(page.getByText("Conectado ao servidor.")).toBeVisible();
});

test("sem login, o diagnóstico pede para entrar antes do teste remoto", async ({
  page,
  context,
}) => {
  await mockBackend(page);
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => localStorage.setItem("ag3.install.skip", "1"));
  await page.goto("/diagnostico");
  await expect(page.getByText("Entre na conta para testar a notificação remota.")).toBeVisible();
});
