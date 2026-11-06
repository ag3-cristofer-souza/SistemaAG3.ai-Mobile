import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/ui/feedback";

export function ConversasPage() {
  return (
    <EmptyState icon={MessageCircle} title="Conversas">
      <p>Esta tela ainda está em construção.</p>
    </EmptyState>
  );
}
