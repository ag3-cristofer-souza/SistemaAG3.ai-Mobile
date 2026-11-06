import { CloudOff } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { Button } from "@/ui/button";
import { EmptyState, FullScreenLoader } from "@/ui/feedback";
import { useAuth } from "./AuthProvider";

export function RequireAuth() {
  const { state, retry, signOut } = useAuth();
  if (state.status === "loading") return <FullScreenLoader />;
  if (state.status === "anon") return <Navigate to="/login" replace />;
  if (state.status === "error") {
    return (
      <div className="h-dvh">
        <EmptyState icon={CloudOff} title="Não foi possível carregar">
          <p>{state.message}</p>
          <div className="mt-4 space-y-2">
            <Button block onClick={retry}>
              Tentar de novo
            </Button>
            <Button block variant="ghost" onClick={signOut}>
              Sair
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }
  return <Outlet />;
}
