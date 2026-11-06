import { BarChart3, MessageCircle, Target, UserRound, type LucideIcon } from "lucide-react";
import { isManagerRole, type AppRole } from "@/lib/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ATENDIMENTO: NavItem = { to: "/conversas", label: "Atendimento", icon: MessageCircle };
const DASHBOARDS: NavItem = { to: "/dashboards", label: "Dashboards", icon: BarChart3 };
const MEUS_NUMEROS: NavItem = { to: "/meus-numeros", label: "Meus números", icon: Target };
const CONTA: NavItem = { to: "/conta", label: "Conta", icon: UserRound };

/** Frente do pedido do cliente (plano, seção 5). O Calendário entra aqui quando a Onda 9 estiver pronta: nada de aba vazia. */
export function navItemsFor(role: AppRole): NavItem[] {
  return isManagerRole(role)
    ? [ATENDIMENTO, DASHBOARDS, CONTA]
    : [ATENDIMENTO, MEUS_NUMEROS, CONTA];
}

export const homeFor = (role: AppRole): string => navItemsFor(role)[0]!.to;
