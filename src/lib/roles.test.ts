import { describe, expect, it } from "vitest";
import { effectiveRole, normalizeRole } from "./roles";

describe("normalizeRole", () => {
  it("aceita os apelidos usados no banco", () => {
    expect(normalizeRole("Gestor")).toBe("manager");
    expect(normalizeRole(" owner ")).toBe("admin");
    expect(normalizeRole("operador")).toBe("operator");
  });

  it("trata valor desconhecido como operador, o papel com menos acesso", () => {
    expect(normalizeRole("xyz")).toBe("operator");
    expect(normalizeRole(null)).toBe("operator");
  });
});

describe("effectiveRole", () => {
  const me = {
    workspaces: [
      { company_id: "a", role: "operator" },
      { company_id: "b", role: "manager" },
    ],
  };

  it("usa o papel da empresa ativa, não o maior que a pessoa tem", () => {
    expect(effectiveRole(me, "a")).toBe("operator");
    expect(effectiveRole(me, "b")).toBe("manager");
  });

  it("super admin é admin em qualquer empresa", () => {
    expect(effectiveRole({ is_super_admin: true, workspaces: [] }, "a")).toBe("admin");
  });

  it("admin de outra empresa não vira admin na empresa sem linha própria", () => {
    expect(effectiveRole({ workspaces: [{ company_id: "x", role: "admin" }] }, "y")).toBe(
      "operator"
    );
  });

  it("sem linha na empresa ativa, gestor de outra empresa não vira gestor", () => {
    expect(effectiveRole(me, "c")).toBe("operator");
  });
});
