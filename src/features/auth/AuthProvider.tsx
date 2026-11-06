import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, type Me } from "@/api/auth";
import { ApiError, setUnauthorizedHandler } from "@/api/client";
import { clearSession, getToken, hasOwnSession, setToken } from "@/lib/session";
import { outbox } from "@/features/conversas/outbox";
import { forgetDeviceRegistration } from "@/lib/push";
import { realtime } from "@/realtime";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "error"; message: string }
  | { status: "authed"; user: Me };

interface AuthContextValue {
  state: AuthState;
  completeLogin: (token: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
  /** Confere o token com o servidor; se tiver sido recusado, encerra a sessão local. */
  revalidate: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: "loading" } : { status: "anon" }
  );

  const clearLocal = useCallback(() => {
    realtime.disconnect();
    clearSession();
    queryClient.clear();
    outbox.clear();
    forgetDeviceRegistration();
    setState({ status: "anon" });
  }, [queryClient]);

  /**
   * Encerra a sessão deste aparelho no servidor, o que também interrompe as notificações. Só com sessão própria: um token
   * do painel é compartilhado, e `POST /auth/logout` derrubaria o painel web. Sem rede, sai do aparelho do mesmo jeito.
   */
  const signOut = useCallback(() => {
    const token = getToken();
    if (token && hasOwnSession()) void authApi.logout(token).catch(() => undefined);
    clearLocal();
  }, [clearLocal]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setState({ status: "anon" });
      return;
    }
    setState((current) => (current.status === "authed" ? current : { status: "loading" }));
    try {
      setState({ status: "authed", user: await authApi.me() });
    } catch (error) {
      // 401 já encerrou a sessão pelo handler. Sem rede, o token continua válido: oferece tentar de novo.
      if (error instanceof ApiError && error.status === 401) return;
      const message = error instanceof ApiError ? error.detail : "Não foi possível carregar.";
      setState((current) => (current.status === "authed" ? current : { status: "error", message }));
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearLocal);
    void load();
    return () => setUnauthorizedHandler(null);
  }, [load, clearLocal]);

  const completeLogin = useCallback(
    async (token: string) => {
      setToken(token);
      try {
        setState({ status: "authed", user: await authApi.me() });
      } catch (error) {
        clearLocal();
        throw error;
      }
    },
    [clearLocal]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, completeLogin, signOut, retry: load, revalidate: load }),
    [state, completeLogin, signOut, load]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}

/** Para telas atrás de `RequireAuth`, onde o usuário já está garantido. */
export function useCurrentUser(): Me {
  const { state } = useAuth();
  if (state.status !== "authed") throw new Error("useCurrentUser exige usuário autenticado");
  return state.user;
}
