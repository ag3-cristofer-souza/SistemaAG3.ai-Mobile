import { defineConfig, devices } from "@playwright/test";

/** A API e o WebSocket são sempre simulados: estes testes nunca falam com um servidor real. */
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_CHANNEL === "chromium" ? undefined : "chrome",
    permissions: ["microphone"],
    // A abertura cobre a tela por ~2 s; só o teste dela a liga.
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_URL: "https://api.teste.invalid",
      VITE_REALTIME_URL: "wss://api.teste.invalid/ws/realtime",
    },
  },
});
