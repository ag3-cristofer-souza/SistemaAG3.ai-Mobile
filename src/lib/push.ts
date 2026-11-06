import { pushApi } from "@/api/push";
import { currentPlatform, isStandalone } from "./pwa";

export type PushStatus = "unsupported" | "needs-install" | "default" | "granted" | "denied";

export function getPushStatus(): PushStatus {
  // No iPhone, as APIs de notificação só existem com o app instalado na tela de início.
  if (currentPlatform() === "ios" && !isStandalone()) return "needs-install";
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission;
}

/** O navegador só aceita este pedido a partir de um toque do usuário. */
export async function requestPushPermission(): Promise<PushStatus> {
  await Notification.requestPermission();
  return getPushStatus();
}

async function readyRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("O service worker não ficou pronto.")), timeoutMs);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Notificação gerada no próprio aparelho: prova a permissão e a aparência, sem depender do Firebase. */
export async function showTestNotification(): Promise<void> {
  const registration = await readyRegistration();
  await registration.showNotification("AG3", {
    body: "Notificação de teste. Toque para voltar ao diagnóstico.",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-48.png",
    tag: "ag3-teste",
    data: { url: "/diagnostico" },
  });
}

/** Token deste aparelho no FCM, com a configuração vinda do Django. Firebase é carregado só aqui, porque pesa. */
export async function getFcmToken(): Promise<string> {
  const config = await pushApi.config();
  if (!config) throw new Error("As notificações remotas ainda não foram configuradas no servidor.");
  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("@firebase/app"),
    import("@firebase/messaging"),
  ]);
  if (!(await isSupported()))
    throw new Error("Este navegador não aceita notificações do Firebase.");
  const { vapidKey, ...options } = config;
  const app = getApps()[0] ?? initializeApp(options);
  return getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: await readyRegistration(),
  });
}

/** Pede o token ao FCM e registra no Django. Depois disso, o Admin já consegue enviar um teste a este aparelho. */
export async function registerThisDevice(): Promise<void> {
  await pushApi.registerDevice(await getFcmToken(), currentPlatform());
}
