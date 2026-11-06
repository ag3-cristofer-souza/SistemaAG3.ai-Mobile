import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Porta 3000: já aceita pelo CORS do Django em APP_ENV=dev, e o painel usa a 5173.
  server: { host: true, port: 3000, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // opus-media-recorder (UMD) referencia `global`, que não existe no navegador.
  define: { global: "globalThis" },
  build: { sourcemap: false },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "AG3",
        short_name: "AG3",
        description: "Atendimento e acompanhamento da operação AG3 pelo celular.",
        lang: "pt-BR",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#12224e",
        theme_color: "#fafcff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        // runtime-config.js muda por ambiente e tem rota própria no service worker.
        globPatterns: ["**/*.{js,css,html,png,svg,wasm}"],
        globIgnores: ["runtime-config.js"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: true, type: "module", navigateFallback: "index.html" },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
