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
}

/** Simula o backend. Devolve as mensagens que o cliente mandou pelo WebSocket. */
async function mockBackend(page: Page, options: MockOptions = {}) {
  const { role = "operator", mfa = false, sessionToken = false } = options;
  const token = sessionToken ? "ag3s_teste" : "tok";
  const workspaces = options.workspaces ?? [
    { company_id: "c1", company_name: "Empresa Um", is_primary: true },
  ];
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
    return route.fulfill(json({ detail: "não simulado" }, 404));
  });

  const sockets: Array<{ protocols: string | null; sent: Record<string, unknown>[] }> = [];
  await page.routeWebSocket(/\/ws\/realtime/, (ws) => {
    const entry = {
      protocols: ws.url() ? "aberto" : null,
      sent: [] as Record<string, unknown>[],
    };
    sockets.push(entry);
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as Record<string, unknown>;
      entry.sent.push(message);
      if (message.type === "subscribe") {
        ws.send(JSON.stringify({ type: "subscribed", company_id: message.company_id, tables: [] }));
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
