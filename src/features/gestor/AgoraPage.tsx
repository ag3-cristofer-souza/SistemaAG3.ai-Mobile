import { Gauge } from "lucide-react";
import { EmptyState } from "@/ui/feedback";

export function AgoraPage() {
  return (
    <EmptyState icon={Gauge} title="Agora">
      <p>Esta tela ainda está em construção.</p>
    </EmptyState>
  );
}
