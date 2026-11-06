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
  cards?: Array<Record<string, unknown>>;
  agenda?: Array<Record<string, unknown>>;
  preferencesFail?: boolean;
  preferencesSaveFail?: boolean;
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

const OVERVIEW = {
  commercial: {
    kpis: { leadsPeriod: 120, conversionsMonth: 12 },
    executiveSummary: {
      uniqueContacts: 100,
      interestedOrQualified: 30,
      conversionsInPeriod: 12,
      conversionRatePercent: 10,
    },
    previous: { leads: 100, conversions: 10 },
    leadsData: [
      { date: "2026-11-05", leads: 50 },
      { date: "2026-11-06", leads: 70 },
    ],
    teamPerformance: [{ userId: "o2", name: "Olga Online", conversions: 7 }],
  },
  attendance: { new_attendances: 40, avg_waiting_time_seconds: 300, transfers: 3 },
  zap: {
    summary: {
      contatos: 80,
      contatei: 50,
      efetivas: 25,
      efetividade: 50,
      aResponder: 6,
      semRetorno: 25,
      contas: 2,
      mensagensEnviadas: 300,
      mensagensRecebidas: 200,
    },
    rows: [{ name: "Canal Vendas", contatos: 80, efetivas: 25, efetividade: 50, aResponder: 6 }],
  },
};

const MARKETING = {
  resumo: {
    leads: 90,
    leads_novos: 70,
    qualificados: 20,
    ganhos: 9,
    receita: 4500,
    taxa_ganho: 10,
    gasto: 1000,
    cpl: 11.11,
    roas: 4.5,
    sem_origem: 5,
    plataforma: { impressoes: 9000, cliques: 400, conversas: 100, leads: 95 },
  },
  canais: [
    {
      canal: "Meta Ads",
      leads: 60,
      ganhos: 6,
      receita: 3000,
      campanhas: [{ nome: "Campanha Black", leads: 40, ganhos: 4, receita: 2000 }],
    },
  ],
  fontes: [{ fonte: "instagram", leads: 33, ganhos: 2, receita: 500 }],
  moeda: "BRL",
  tem_gasto: true,
};

const ORIGEM = {
  kpis: { entradas: 120, novos: 90, ganhos: 9, perdidos: 15, pendentes: 4 },
  mensagens_iniciais: [{ mensagem: "Quero saber mais", entradas: 44 }],
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
  const preferencias = {
    new_message: true,
    assignment: true,
    agenda: true,
    manager_alerts: true,
    queue_alert_minutes: 10,
  };
  const notes: unknown[] = [];
  const crmNotes: unknown[] = [];
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
    if (path === "/pipelines") {
      return route.fulfill(json({ data: [{ id: "p1", name: "Vendas", is_default: true }] }));
    }
    if (path === "/pipelines/stages/all") return route.fulfill(json({ data: [] }));
    if (path === "/produtos/dynamic-statuses") return route.fulfill(json({ data: [] }));
    if (path === "/produtos") return route.fulfill(json({ data: options.cards ?? [] }));
    const card = path.match(/^\/produtos\/([^/]+)(\/assume)?$/);
    if (card) {
      const found = (options.cards ?? []).find((item) => item.id === card[1]);
      if (found && card[2]) Object.assign(found, { assigned_to: "u1" });
      if (found && request.method() === "PUT") Object.assign(found, request.postDataJSON());
      return route.fulfill(json({ data: found ?? {} }));
    }
    if (path === "/notes") {
      if (request.method() === "POST") {
        const note = {
          id: `crm-${crmNotes.length}`,
          content: (request.postDataJSON() as { content: string }).content,
          created_at: "2026-11-06T12:00:00Z",
        };
        crmNotes.push(note);
        return route.fulfill(json({ data: note }));
      }
      return route.fulfill(json({ data: crmNotes }));
    }
    if (path === "/leads/lead-1") {
      return route.fulfill(
        json({
          data: {
            id: "lead-1",
            name: "Maria Cliente",
            phone: "5511999990000",
            email: "maria@cliente.test",
            created_at: "2026-10-01T12:00:00Z",
          },
        })
      );
    }
    if (path === "/leads/lead-1/origem") {
      return route.fulfill(json({ data: { resumo: { primeira: { label: "Meta Ads" } } } }));
    }
    if (path === "/leads/lead-1/history") {
      return route.fulfill(
        json({
          data: [
            {
              id: "h1",
              kind: "card_etapa",
              created_at: "2026-10-02T12:00:00Z",
              from_label: "Pendente",
              to_label: "Em Atendimento",
              description: null,
              actor_name: "Pessoa Teste",
            },
          ],
        })
      );
    }
    if (path === "/push/preferences") {
      if (options.preferencesFail) return route.fulfill(json({ detail: "x" }, 500));
      if (request.method() === "PATCH") {
        if (options.preferencesSaveFail) return route.fulfill(json({ detail: "x" }, 500));
        Object.assign(preferencias, request.postDataJSON());
      }
      return route.fulfill(json({ data: preferencias }));
    }
    if (path === "/calendar/feed") {
      const atrasadas = new URL(request.url()).searchParams.get("overdue") === "true";
      return route.fulfill(
        json({ data: (options.agenda ?? []).filter((item) => Boolean(item.overdue) === atrasadas) })
      );
    }
    const agendaItem = path.match(/^\/calendar\/items\/(event|task)\/([^/]+)$/);
    if (agendaItem) {
      const found = (options.agenda ?? []).find((item) => item.id === agendaItem[2]);
      return route.fulfill(found ? json({ data: found }) : json({ detail: "x" }, 404));
    }
    if (path === "/agenda-types") {
      return route.fulfill(
        json({ data: [{ id: "t1", name: "Reunião", color: "#3b82f6", applies_to: "both" }] })
      );
    }
    if (path === "/events" || path === "/tasks")
      return route.fulfill(json({ data: { id: "novo" } }));
    if (/^\/(events|tasks)\/[^/]+(\/complete)?$/.test(path))
      return route.fulfill(json({ data: {} }));
    if (path === "/leads") {
      return route.fulfill(
        json({ data: [{ id: "lead-1", name: "Maria Cliente", phone: "5511" }] })
      );
    }
    if (path === "/dashboard/overview") return route.fulfill(json({ data: OVERVIEW }));
    if (path === "/reports/marketing/visao") {
      if (role === "operator") return route.fulfill(json({ detail: "Permissao negada" }, 403));
      return route.fulfill(json({ data: MARKETING }));
    }
    if (path === "/reports/entries/origem") return route.fulfill(json({ data: ORIGEM }));
    if (path === "/marketing/conversions/events") {
      return route.fulfill(
        json({
          data: [
            { deliveries: [{ platform: "meta", status: "sent" }] },
            { deliveries: [{ platform: "meta", status: "failed" }] },
          ],
        })
      );
    }
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
      if (chat[2] === "/assign") {
        // Como o servidor: a conversa passa a estar com quem assumiu.
        const assumed = (options.conversations ?? []).find((item) => item.id === chat[1]);
        if (assumed) Object.assign(assumed, { status: "in_attendance", assigned_agent_id: "u1" });
        return route.fulfill(json({ data: {} }));
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

test("operador entra no Atendimento, sem Dashboards, e assina a empresa em tempo real", async ({
  page,
}) => {
  const sockets = await mockBackend(page, { role: "operator" });
  await passInstallGate(page);
  await login(page);
  await expect(page).toHaveURL(/\/conversas$/);
  await expect(page.getByRole("heading", { name: "Empresa Um" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboards" })).toHaveCount(0);
  await expect(page.getByText("Ao vivo")).toBeVisible();
  expect(sockets.at(-1)?.sent[0]).toMatchObject({ type: "subscribe", company_id: "c1" });

  await page.goto("/agora");
  await expect(page).toHaveURL(/\/conversas$/);
});

test("gestor entra no Atendimento e vê as três abas", async ({ page }) => {
  await mockBackend(page, { role: "manager" });
  await passInstallGate(page);
  await login(page);
  await expect(page).toHaveURL(/\/conversas$/);
  for (const name of ["Atendimento", "Dashboards", "Conta"]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
});

test("o app fica claro mesmo com o aparelho em modo escuro, e o login continua azul", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await mockBackend(page, { role: "manager" });
  await passInstallGate(page);
  await expect(page.locator(".dark")).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#12224e");
  await login(page);
  await expect(page).toHaveURL(/\/conversas$/);
  await expect(page.locator(".dark")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#fafcff");
});

test("gestor vê os números do momento em Dashboards", async ({ page }) => {
  await mockBackend(page, { role: "manager" });
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: "Dashboards" }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
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
  await expect(page.getByRole("link", { name: "Atendimento" })).toHaveCount(0);
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

const COM_LEAD = { ...CONV, lead_id: "lead-1" };
const CARD = {
  id: "card-1",
  lead_id: "lead-1",
  pipeline_id: "p1",
  status: "in_progress",
  assigned_to: "u1",
  closed_at: null,
};

test("muda a etapa do funil e salva a descrição no CRM pela conversa", async ({ page }) => {
  await mockBackend(page, { conversations: [COM_LEAD], messages: [MSG], cards: [{ ...CARD }] });
  await openChat(page, COM_LEAD);
  const bar = page.getByRole("button", { name: /Funil:/ });
  await expect(bar).toContainText("Em Atendimento");
  await bar.click();
  const put = page.waitForRequest(
    (r) => r.url().endsWith("/produtos/card-1") && r.method() === "PUT"
  );
  await page.getByRole("radio", { name: "Convertido" }).click();
  expect((await put).postDataJSON()).toEqual({ status: "converted" });
  await expect(page.getByRole("radio", { name: "Convertido" })).toBeChecked();

  const note = page.waitForRequest((r) => r.url().endsWith("/notes") && r.method() === "POST");
  await page.getByLabel("Descrição no CRM").fill("Fechou o plano anual");
  await page.getByRole("button", { name: "Salvar descrição" }).click();
  expect((await note).postDataJSON()).toEqual({
    lead_id: "lead-1",
    content: "Fechou o plano anual",
  });
  await expect(page.getByText("Descrição salva no lead.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(bar).toContainText("Convertido");
});

test("card sem dono precisa ser assumido antes de mudar a etapa", async ({ page }) => {
  await mockBackend(page, {
    conversations: [COM_LEAD],
    messages: [MSG],
    cards: [{ ...CARD, assigned_to: null, status: "pending" }],
  });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: /Funil:/ }).click();
  await expect(page.getByRole("radio", { name: "Convertido" })).toBeDisabled();
  await page.getByRole("button", { name: "Assumir card" }).click();
  await expect(page.getByRole("radio", { name: "Convertido" })).toBeEnabled();
});

test("card de outro operador mostra a etapa sem deixar mudar", async ({ page }) => {
  await mockBackend(page, {
    conversations: [COM_LEAD],
    messages: [MSG],
    cards: [{ ...CARD, assigned_to: "u2", assignedToName: "Olga" }],
  });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: /Funil:/ }).click();
  await expect(page.getByText("Este card é de Olga")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Convertido" })).toBeDisabled();
});

test("o ponto de exclamação mostra quando o lead entrou, a origem e o histórico", async ({
  page,
}) => {
  await mockBackend(page, { conversations: [COM_LEAD], messages: [MSG], cards: [{ ...CARD }] });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: "Informações do lead" }).click();
  const painel = page.getByRole("dialog", { name: "Informações do lead" });
  await expect(painel.getByText("maria@cliente.test")).toBeVisible();
  await expect(painel.getByText("Entrou em")).toBeVisible();
  await expect(painel.getByText("Meta Ads")).toBeVisible();
  await expect(painel.getByText("Etapa alterada")).toBeVisible();
  await expect(painel.getByText("Pendente → Em Atendimento")).toBeVisible();
});

test("finalizar registra a etapa e a descrição antes de encerrar", async ({ page }) => {
  await mockBackend(page, { conversations: [COM_LEAD], messages: [MSG], cards: [{ ...CARD }] });
  const ordem: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (r.method() === "PUT" && path === "/produtos/card-1") ordem.push("etapa");
    if (r.method() === "POST" && path === "/notes") ordem.push("descricao");
    if (r.method() === "POST" && path.endsWith("/finish")) ordem.push("finalizar");
  });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Finalizar atendimento" }).click();
  await page.getByLabel("Etapa do funil").selectOption("converted");
  await page.getByLabel("Descrição no CRM (opcional)").fill("Cliente fechou");
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(page).toHaveURL(/\/conversas$/);
  expect(ordem).toEqual(["etapa", "descricao", "finalizar"]);
});

test("se a etapa falhar, o atendimento não é encerrado", async ({ page }) => {
  await mockBackend(page, { conversations: [COM_LEAD], messages: [MSG], cards: [{ ...CARD }] });
  await page.route(`${API}/produtos/card-1`, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ detail: "Etapa inválida." }),
        })
      : route.fallback()
  );
  let finished = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/finish")) finished = true;
  });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Finalizar atendimento" }).click();
  await page.getByLabel("Etapa do funil").selectOption("converted");
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Etapa inválida.");
  expect(finished).toBe(false);
});

test("devolve a conversa para a IA com confirmação", async ({ page }) => {
  await mockBackend(page, { conversations: [CONV], messages: [MSG] });
  await openChat(page);
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Devolver para a IA" }).click();
  const request = page.waitForRequest((r) => r.url().endsWith("/conv-1/return-to-ai"));
  await page.getByRole("button", { name: "Devolver para a IA" }).click();
  await request;
  await expect(page).toHaveURL(/\/conversas$/);
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

test("aviso de outra empresa abre a conversa nessa empresa", async ({ page }) => {
  await mockBackend(page, {
    role: "admin",
    conversations: [CONV],
    messages: [MSG],
    workspaces: [
      { company_id: "c1", company_name: "Empresa Um", is_primary: true },
      { company_id: "c2", company_name: "Empresa Dois", is_primary: false },
    ],
  });
  const companies: Array<string | undefined> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/conversations/conv-1"))
      companies.push(request.headers()["x-company-id"]);
  });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
    localStorage.setItem("ag3.workspace", "c1");
  });
  await page.goto("/conversas/conv-1?empresa=c2");
  await expect(page.getByRole("heading", { name: "Maria Cliente" })).toBeVisible();
  expect(companies.length).toBeGreaterThan(0);
  expect(new Set(companies)).toEqual(new Set(["c2"]));
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ag3.workspace"))).toBe("c2");
});

test("conta mostra o estado das notificações deste aparelho", async ({ page, context }) => {
  await mockBackend(page, { sessionToken: true });
  await passInstallGate(page);
  await login(page);
  await page.getByRole("link", { name: "Conta" }).click();
  await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible();
  await context.grantPermissions(["notifications"]);
  await page.reload();
  await expect(page.getByText("Ativadas neste aparelho")).toBeVisible();
});

test("operador escolhe o que receber, e a escolha vai para o Django", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await mockBackend(page, { role: "operator" });
  await abrirAgenda(page, "/conta");
  const mensagens = page.getByRole("switch", { name: "Mensagens novas" });
  await expect(mensagens).toBeChecked();
  await expect(page.getByRole("switch", { name: "Alertas da operação" })).toHaveCount(0);
  const pedido = page.waitForRequest(
    (r) => r.url().endsWith("/push/preferences") && r.method() === "PATCH"
  );
  await mensagens.click();
  expect((await pedido).postDataJSON()).toEqual({ new_message: false });
  await expect(mensagens).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Mensagens novas" })).not.toBeChecked();
});

test("gestor liga os alertas e escolhe o limite da fila", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await mockBackend(page, { role: "manager" });
  await abrirAgenda(page, "/conta");
  const limite = page.getByLabel("Avisar quando alguém esperar na fila por mais de");
  await expect(limite).toHaveValue("10");
  const pedido = page.waitForRequest(
    (r) => r.url().endsWith("/push/preferences") && r.method() === "PATCH"
  );
  await limite.selectOption("30");
  expect((await pedido).postDataJSON()).toEqual({ queue_alert_minutes: 30 });
  await page.getByRole("switch", { name: /Alertas da operação/ }).click();
  await expect(limite).toHaveCount(0);
});

test("falha ao salvar a preferência desfaz o interruptor e avisa", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await mockBackend(page, { role: "operator", preferencesSaveFail: true });
  await abrirAgenda(page, "/conta");
  const compromissos = page.getByRole("switch", { name: "Compromissos" });
  await compromissos.click();
  await expect(page.getByText("Não foi possível salvar. Tente de novo.")).toBeVisible();
  await expect(compromissos).toBeChecked();
});

test("servidor sem preferências não atrapalha o resto da conta", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await mockBackend(page, { role: "operator", preferencesFail: true });
  await abrirAgenda(page, "/conta");
  await expect(page.getByText("Não foi possível carregar o que você escolheu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
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

test("dashboards mostram comercial, marketing e PerformaZap, com o período na API", async ({
  page,
}) => {
  await mockBackend(page, { role: "manager" });
  const pedidos: URL[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/reports/marketing/visao") pedidos.push(url);
  });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/dashboards");
  await expect(page.getByText("Fila sem dono")).toBeVisible();

  await page.getByRole("tab", { name: "Comercial" }).click();
  await expect(page.getByText("Leads que entraram")).toBeVisible();
  await expect(page.getByText("+20% sobre o período anterior").first()).toBeVisible();
  await expect(page.getByText("Perdidos")).toBeVisible();
  await expect(page.getByText("15", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Olga Online" })).toContainText("7");

  await page.getByRole("tab", { name: "Marketing" }).click();
  await expect(page.getByText("Campanha Black")).toBeVisible();
  await expect(page.getByText("instagram")).toBeVisible();
  await expect(page.getByText("Quero saber mais")).toBeVisible();
  await expect(page.getByText("Dos últimos 2 eventos: 1 enviados e 1 com falha.")).toBeVisible();

  await page.getByRole("button", { name: "30 dias" }).click();
  await expect(page).toHaveURL(/periodo=30d/);
  await expect.poll(() => pedidos.length).toBeGreaterThan(1);
  expect(pedidos.at(-1)!.searchParams.get("start_date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await page.getByRole("tab", { name: "PerformaZap" }).click();
  await expect(page.getByText("Canal Vendas")).toBeVisible();
  await expect(page.getByText("6 a responder", { exact: false })).toBeVisible();
});

test("operador vê os próprios números e não entra em Dashboards", async ({ page }) => {
  await mockBackend(page, { role: "operator" });
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto("/meus-numeros");
  await expect(page.getByText("Na sua fila")).toBeVisible();
  await expect(page.getByText("Limite: 5")).toBeVisible();
  await expect(page.getByText("Atendimentos novos")).toBeVisible();
  await page.goto("/dashboards");
  await expect(page).toHaveURL(/\/conversas$/);
});

function agendaHoje(fields: Record<string, unknown> = {}) {
  const start = new Date();
  start.setHours(23, 0, 0, 0);
  return {
    kind: "event",
    id: "ev-1",
    title: "Reunião com Maria",
    description: "Levar a proposta",
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    status: "confirmed",
    done: false,
    overdue: false,
    attendance: null,
    type: { id: "t1", name: "Reunião", color: "#3b82f6" },
    owner: { id: "u1", name: "Pessoa Teste" },
    lead: { id: "lead-1", name: "Maria Cliente" },
    meet_link: null,
    ...fields,
  };
}

async function abrirAgenda(page: Page, path = "/calendario") {
  await page.addInitScript(() => {
    localStorage.setItem("ag3.token", "tok");
    localStorage.setItem("ag3.install.skip", "1");
  });
  await page.goto(path);
}

test("calendário mostra o dia, cria um compromisso e todos têm a aba", async ({ page }) => {
  await mockBackend(page, { role: "operator", agenda: [agendaHoje()] });
  await abrirAgenda(page);
  await expect(page.getByRole("link", { name: "Calendário" })).toBeVisible();
  await expect(page.getByText("Reunião com Maria")).toBeVisible();
  await expect(page.getByRole("group", { name: "De quem" })).toHaveCount(0);

  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page.getByLabel("Título").fill("Visita técnica");
  await page.getByLabel("Tipo", { exact: true }).selectOption("t1");
  await page.getByLabel("Duração").selectOption("60");
  await page.getByLabel("Lead (opcional)").fill("mari");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Maria Cliente/ })
    .click();
  const pedido = page.waitForRequest((r) => r.url().endsWith("/events") && r.method() === "POST");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const corpo = (await pedido).postDataJSON();
  expect(corpo).toMatchObject({ title: "Visita técnica", lead_id: "lead-1", type_id: "t1" });
  expect(corpo.assigned_to).toBeUndefined();
  expect(new Date(corpo.end_at).getTime() - new Date(corpo.start_at).getTime()).toBe(3_600_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("tarefa nova vai para a rota de tarefas, com duração", async ({ page }) => {
  await mockBackend(page, { role: "operator" });
  await abrirAgenda(page);
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page.getByRole("button", { name: "Tarefa" }).click();
  await page.getByLabel("Título").fill("Ligar");
  const pedido = page.waitForRequest((r) => r.url().endsWith("/tasks") && r.method() === "POST");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  expect((await pedido).postDataJSON()).toMatchObject({
    title: "Ligar",
    duration_min: 30,
    status: "todo",
    assigned_to: "u1",
  });
});

test("mini calendário escolhe o dia, muda de mês e recolhe para a semana", async ({ page }) => {
  await mockBackend(page, { role: "operator", agenda: [agendaHoje()] });
  const janelas: Array<{ from: string; to: string }> = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/calendar/feed" && !url.searchParams.get("overdue")) {
      janelas.push({ from: url.searchParams.get("from")!, to: url.searchParams.get("to")! });
    }
  });
  await abrirAgenda(page);
  const hoje = new Date();
  const mes = (data: Date) => data.toLocaleDateString("pt-BR", { month: "long" });
  const dias = page.getByRole("group", { name: "Dias do mês" });
  await expect(
    dias.getByRole("button", { name: `${hoje.getDate()} de ${mes(hoje)}, com compromissos` })
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Dias da semana" })).toHaveCount(0);
  await expect(page.getByText("Reunião com Maria")).toBeVisible();

  const outroDia = hoje.getDate() === 15 ? 16 : 15;
  await dias.getByRole("button", { name: `${outroDia} de ${mes(hoje)}`, exact: true }).click();
  await expect(page.getByText("Nada marcado neste dia")).toBeVisible();

  await page.getByRole("button", { name: "Próximo mês" }).click();
  const seguinte = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  await expect(
    page.getByRole("heading", { name: new RegExp(`${mes(seguinte)} de ${seguinte.getFullYear()}`) })
  ).toBeVisible();
  await expect.poll(() => janelas.length).toBeGreaterThan(1);
  for (const { from, to } of janelas) {
    expect(new Date(to).getTime() - new Date(from).getTime()).toBeLessThanOrEqual(
      42 * 86_400_000 + 3_600_000
    );
  }

  await page.getByRole("button", { name: "Ir para hoje" }).click();
  await expect(page.getByText("Reunião com Maria")).toBeVisible();
  await page.getByRole("button", { name: /ver só a semana/ }).click();
  await expect(page.getByRole("group", { name: "Dias da semana" })).toBeVisible();
  await expect(dias).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("group", { name: "Dias da semana" })).toBeVisible();
});

test("em tela larga, o mini calendário fica ao lado da lista e nada estoura a largura", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 963 });
  await mockBackend(page, { role: "manager", agenda: [agendaHoje()] });
  await abrirAgenda(page);
  const dias = page.getByRole("group", { name: "Dias do mês" });
  const compromisso = page.getByRole("button", { name: /Reunião com Maria/ });
  await expect(compromisso).toBeVisible();
  const lateral = (await dias.boundingBox())!;
  const lista = (await compromisso.boundingBox())!;
  expect(lateral.x + lateral.width).toBeLessThanOrEqual(lista.x);
  expect(lateral.width).toBeLessThan(400);
  await expect(page.getByRole("button", { name: /ver só a semana/ })).toHaveCount(0);
  const novo = (await page.getByRole("button", { name: "Novo compromisso" }).boundingBox())!;
  expect(novo.x + novo.width).toBeLessThanOrEqual(1920);
  const todos = (await page.getByRole("button", { name: "Todos" }).boundingBox())!;
  expect(todos.x + todos.width).toBeLessThanOrEqual(1920);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
});

test("editar e excluir um compromisso, com confirmação", async ({ page }) => {
  await mockBackend(page, { role: "operator", agenda: [agendaHoje()] });
  await abrirAgenda(page);
  await page.getByRole("button", { name: /Reunião com Maria/ }).click();
  await expect(page.getByText("Levar a proposta")).toBeVisible();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Título").fill("Reunião final");
  const patch = page.waitForRequest(
    (r) => r.url().endsWith("/events/ev-1") && r.method() === "PATCH"
  );
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  expect((await patch).postDataJSON()).toMatchObject({ title: "Reunião final", lead_id: "lead-1" });

  await page.getByRole("button", { name: /Reunião com Maria/ }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("fica registrada no histórico do lead")).toBeVisible();
  const apagar = page.waitForRequest(
    (r) => r.url().endsWith("/events/ev-1") && r.method() === "DELETE"
  );
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await apagar;
});

test("notificação abre o compromisso; tarefa atrasada aparece hoje e pode ser concluída", async ({
  page,
}) => {
  const atrasada = agendaHoje({ kind: "task", id: "ta-1", title: "Ligar ontem", overdue: true });
  await mockBackend(page, { role: "operator", agenda: [agendaHoje(), atrasada] });
  await abrirAgenda(page, "/calendario?item=event:ev-1");
  const painel = page.getByRole("dialog", { name: "Compromisso" });
  await expect(painel.getByText("Levar a proposta")).toBeVisible();
  await painel.getByRole("button", { name: "Fechar" }).click();
  await expect(page).toHaveURL(/\/calendario$/);

  await expect(page.getByText("Atrasadas: 1")).toBeVisible();
  await page.getByRole("button", { name: /Ligar ontem/ }).click();
  const concluir = page.waitForRequest((r) => r.url().endsWith("/tasks/ta-1/complete"));
  await page.getByRole("button", { name: "Concluir tarefa" }).click();
  await concluir;
});

test("conversa abre o agendamento com o lead preenchido", async ({ page }) => {
  await mockBackend(page, { conversations: [COM_LEAD], messages: [MSG], cards: [{ ...CARD }] });
  await openChat(page, COM_LEAD);
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Agendar compromisso" }).click();
  await expect(page).toHaveURL(/\/calendario\?novo=1/);
  await expect(page.getByRole("dialog", { name: "Novo" })).toBeVisible();
});

test("gestor escolhe entre os dele e os de todos, e define o responsável", async ({ page }) => {
  await mockBackend(page, { role: "manager", agenda: [agendaHoje()] });
  const owners: Array<string | null> = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/calendar/feed" && !url.searchParams.get("overdue")) {
      owners.push(url.searchParams.get("owner"));
    }
  });
  await abrirAgenda(page);
  await expect(page.getByText("Reunião com Maria")).toBeVisible();
  expect(owners.at(-1)).toBe("me");
  await page.getByRole("button", { name: "Todos" }).click();
  await expect.poll(() => owners.at(-1)).toBeNull();
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page.getByLabel("Título").fill("Reunião do time");
  await page.getByLabel("Responsável").selectOption("u2");
  const pedido = page.waitForRequest((r) => r.url().endsWith("/events") && r.method() === "POST");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  expect((await pedido).postDataJSON().assigned_to).toBe("u2");
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
  expect(titles).toContain("Notificações ativas");
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
