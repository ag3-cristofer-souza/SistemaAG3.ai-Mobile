/** Sessão guardada no aparelho. O acesso ao storage pode falhar (modo privado), então nada aqui lança erro. */
const TOKEN_KEY = "ag3.token";
const WORKSPACE_KEY = "ag3.workspace";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sem storage, a sessão dura só enquanto o app estiver aberto.
  }
}

export const getToken = () => read(TOKEN_KEY);
/** Sessão própria do aparelho. O token do painel é compartilhado: não pode ser encerrado daqui. */
export const hasOwnSession = () => (read(TOKEN_KEY) ?? "").startsWith("ag3s_");
export const setToken = (token: string) => write(TOKEN_KEY, token);
export const getWorkspaceId = () => read(WORKSPACE_KEY);
export const setWorkspaceId = (id: string | null) => write(WORKSPACE_KEY, id);

/** Apaga o que identifica o usuário. A escolha de pular a instalação fica, porque é do aparelho. */
export function clearSession(): void {
  write(TOKEN_KEY, null);
  write(WORKSPACE_KEY, null);
}
