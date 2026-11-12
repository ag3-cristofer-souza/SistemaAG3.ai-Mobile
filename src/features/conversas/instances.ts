import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Conversation } from "@/api/conversations";
import { instancesApi, type Instance } from "@/api/instances";
import { formatPhone } from "@/lib/format";

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

const nameOf = (instance: Instance) =>
  instance.display_name ||
  instance.name ||
  instance.instance_name ||
  formatPhone(instance.number || instance.display_phone_number || instance.connected_phone);

/**
 * Por qual canal a conversa chegou. Procura a instância pelo id e, nas conversas antigas que só guardam o número, pelo
 * número. Instância que o servidor não listou para esta pessoa aparece pelo número da conversa.
 */
export function instanceLabel(
  conversation: Pick<Conversation, "connected_instance_id" | "connected_phone">,
  instances: Instance[] | undefined
): string | null {
  const id = conversation.connected_instance_id?.toLowerCase();
  const phone = digits(conversation.connected_phone);
  const found =
    (id && instances?.find((instance) => instance.id.toLowerCase() === id)) ||
    (phone &&
      instances?.find((instance) =>
        [instance.number, instance.display_phone_number, instance.connected_phone].some(
          (number) => digits(number) === phone
        )
      )) ||
    null;
  if (found) return nameOf(found) || null;
  return formatPhone(conversation.connected_phone) || null;
}

/** Os nomes mudam pouco: busca uma vez a cada 10 min. Se falhar, a conversa mostra o número do canal. */
export function useInstanceLabel() {
  const instances = useQuery({
    queryKey: ["instances"],
    queryFn: instancesApi.list,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const list = instances.data;
  return useCallback(
    (conversation: Pick<Conversation, "connected_instance_id" | "connected_phone">) =>
      instanceLabel(conversation, list),
    [list]
  );
}
