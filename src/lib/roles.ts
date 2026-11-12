/** Papel efetivo na empresa ativa. Espelha `normalizeAppRole` do painel; a permissão real é do servidor. */
export type AppRole = "admin" | "manager" | "operator";

const ADMIN = ["admin", "administrator", "superadmin", "super_admin", "owner", "root"];
const MANAGER = ["manager", "gestor", "lead", "gerente"];

export function normalizeRole(raw: unknown): AppRole {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (ADMIN.includes(value)) return "admin";
  if (MANAGER.includes(value)) return "manager";
  return "operator";
}

export interface RoleSource {
  is_super_admin?: boolean;
  workspaces?: Array<{ company_id?: string | null; role?: string | null }>;
}

export function effectiveRole(me: RoleSource, workspaceId: string | null): AppRole {
  if (me.is_super_admin) return "admin";
  const rows = me.workspaces ?? [];
  const current = rows.find((row) => row.company_id && row.company_id === workspaceId);
  if (current) return normalizeRole(current.role);
  // Sem linha na empresa ativa, nenhum papel elevado: o servidor só lista (e só aceita) empresas com papel
  // (onda 0 do plano de parceiros, 12/11). Antes, admin de uma empresa virava admin em todas.
  return "operator";
}

export const isManagerRole = (role: AppRole) => role === "admin" || role === "manager";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  operator: "Operador",
};
