/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { notificationOptions, parsePush } from "./sw-logic";

declare const self: ServiceWorkerGlobalScope;

/**
 * Guarda só os arquivos do app. Respostas da API nunca entram em cache: têm dados de clientes e não podem ficar no
 * aparelho depois de sair da conta.
 */
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

if (import.meta.env.PROD) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));
}

// Muda por ambiente: vem da rede quando possível, e a última cópia permite abrir o app sem conexão. `no-store` ignora o cache
// do navegador, que pode ter guardado um 404 por horas se o arquivo faltou uma vez (a Cloudflare manda guardar).
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname === "/runtime-config.js",
  new NetworkFirst({
    cacheName: "ag3-config",
    networkTimeoutSeconds: 3,
    fetchOptions: { cache: "no-store" },
  })
);

// Trata o push direto, sem o SDK do Firebase aqui: o token vem do FCM, mas a entrega é Web Push padrão.
self.addEventListener("push", (event) => {
  let payload: unknown;
  try {
    payload = event.data?.json();
  } catch {
    payload = undefined;
  }
  const view = parsePush(payload);
  event.waitUntil(self.registration.showNotification(view.title, notificationOptions(view)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = parsePush({ data: event.notification.data }).url;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        open.postMessage({ type: "navigate", url });
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
