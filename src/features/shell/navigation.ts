import {
  BarChart3,
  CalendarDays,
  MessageCircle,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { isManagerRole, type AppRole } from "@/lib/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ATENDIMENTO: NavItem = { to: "/conversas", label: "Atendimento", icon: MessageCircle };
const CALENDARIO: NavItem = { to: "/calendario", label: "Calendário", icon: CalendarDays };
const DASHBOARDS: NavItem = { to: "/dashboards", label: "Dashboards", icon: BarChart3 };
const MEUS_NUMEROS: NavItem = { to: "/meus-numeros", label: "Meus números", icon: Target };
const CONTA: NavItem = { to: "/conta", label: "Conta", icon: UserRound };

/** As três frentes do pedido do cliente (plano, seção 5), mais Conta. */
export function navItemsFor(role: AppRole): NavItem[] {
  return [ATENDIMENTO, CALENDARIO, isManagerRole(role) ? DASHBOARDS : MEUS_NUMEROS, CONTA];
}

export const homeFor = (role: AppRole): string => navItemsFor(role)[0]!.to;
