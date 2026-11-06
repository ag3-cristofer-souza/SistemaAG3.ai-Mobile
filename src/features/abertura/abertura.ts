const STORAGE_KEY = "ag3.abertura";

/** Conversa aberta por notificação ou link: a pessoa veio responder, e a abertura só a atrasaria. */
const isDirectConversation = (pathname: string) => /^\/conversas\/[^/]+/.test(pathname);

/** Toca uma vez por sessão, como no site. Quem pede menos movimento não vê. */
export function shouldPlayAbertura(
  pathname: string,
  alreadyPlayed: boolean,
  reducedMotion: boolean
): boolean {
  return !alreadyPlayed && !reducedMotion && !isDirectConversation(pathname);
}

/** Armazenamento pode falhar (modo privado): aí a abertura toca, e some sozinha pelo CSS. */
export function readPlayed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function markPlayed(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Só repete a abertura na próxima página.
  }
}
