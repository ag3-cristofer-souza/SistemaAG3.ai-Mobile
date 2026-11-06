import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { Abertura } from "@/features/abertura/Abertura";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { ContaPage } from "@/features/conta/ContaPage";
import { ChatPage } from "@/features/conversas/ChatPage";
import { ConversasPage } from "@/features/conversas/ConversasPage";
import { DiagnosticsPage } from "@/features/diagnostics/DiagnosticsPage";
import { DashboardsPage } from "@/features/gestor/DashboardsPage";
import { MeusNumerosPage } from "@/features/gestor/MeusNumerosPage";
import { InstallGate } from "@/features/install/InstallGate";
import { AppShell, RequireManager, RoleHome } from "@/features/shell/AppShell";
import { RequireWorkspace } from "@/features/workspace/WorkspaceProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Erro do cliente não melhora repetindo; falha de rede e 5xx podem.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Abertura />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<InstallGate />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/diagnostico" element={<DiagnosticsPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<RequireWorkspace />}>
                  <Route element={<AppShell />}>
                    <Route index element={<RoleHome />} />
                    <Route element={<RequireManager />}>
                      <Route path="/dashboards" element={<DashboardsPage />} />
                      <Route path="/agora" element={<Navigate to="/dashboards" replace />} />
                    </Route>
                    <Route path="/conversas" element={<ConversasPage />} />
                    <Route path="/conversas/:id" element={<ChatPage />} />
                    <Route path="/meus-numeros" element={<MeusNumerosPage />} />
                    <Route path="/conta" element={<ContaPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
