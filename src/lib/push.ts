import { pushApi } from "@/api/push";
import { notificationOptions, parsePush } from "@/sw-logic";
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
  const view = parsePush({
    data: {
      type: "test",
      title: "Notificações ativas",
      body: "É assim que os avisos do AG3 vão aparecer neste aparelho.",
      tag: "ag3-teste",
      url: "/diagnostico",
    },
  });
  await registration.showNotification(view.title, notificationOptions(view));
}

/** Ao abrir a conversa, o aviso dela não tem mais motivo para ficar na bandeja. */
export async function clearConversationNotifications(conversationId: string): Promise<void> {
  if (getPushStatus() !== "granted") return;
  const registration = await readyRegistration();
  const open = await registration.getNotifications({ tag: `conversa:${conversationId}` });
  open.forEach((notification) => notification.close());
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

/**
 * Pede a permissão, se preciso, e registra o aparelho. Devolve o estado final.
 * O navegador só aceita o pedido a partir de um toque do usuário.
 */
export async function enablePush(): Promise<PushStatus> {
  const status = getPushStatus() === "default" ? await requestPushPermission() : getPushStatus();
  if (status === "granted") await registerThisDevice();
  return status;
}

let registeredThisSession = false;

/**
 * Quem já deu permissão fica registrado sem tocar em nada. O aparelho é ligado à sessão: depois de sair e entrar de novo, sem
 * isso, ele pararia de receber. Falhar aqui não atrapalha o uso: a tela Conta permite tentar de novo.
 */
export async function keepDeviceRegistered(): Promise<void> {
  if (registeredThisSession || getPushStatus() !== "granted") return;
  registeredThisSession = true;
  try {
    await registerThisDevice();
  } catch (error) {
    registeredThisSession = false;
    console.warn("[push] aparelho não registrado", error);
  }
}

/** Ao sair da conta: a próxima pessoa neste aparelho registra com a sessão dela. */
export function forgetDeviceRegistration(): void {
  registeredThisSession = false;
}
