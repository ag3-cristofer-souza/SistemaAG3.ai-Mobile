import { Gauge, MessageCircle, UserRound, type LucideIcon } from "lucide-react";
import { isManagerRole, type AppRole } from "@/lib/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const AGORA: NavItem = { to: "/agora", label: "Agora", icon: Gauge };
const CONVERSAS: NavItem = { to: "/conversas", label: "Conversas", icon: MessageCircle };
const CONTA: NavItem = { to: "/conta", label: "Conta", icon: UserRound };

export function navItemsFor(role: AppRole): NavItem[] {
  return isManagerRole(role) ? [AGORA, CONVERSAS, CONTA] : [CONVERSAS, CONTA];
}

export const homeFor = (role: AppRole): string => navItemsFor(role)[0]!.to;
