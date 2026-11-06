import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { realtime } from "@/realtime";

const THROTTLE_MS = 2_000;

/**
 * Qualquer mudança em conversa vira nova busca na API, que aplica a regra de acesso. Assim, os avisos só com o id
 * (grupos, payload grande) e as remoções por transferência funcionam do mesmo jeito.
 */
export function useConversationEvents(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["conversation-counts"] });
      }, THROTTLE_MS);
    };
    const offs = [
      realtime.on("conversations", refresh),
      realtime.on("conversation_assignments", refresh),
    ];
    return () => {
      offs.forEach((off) => off());
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);
}
