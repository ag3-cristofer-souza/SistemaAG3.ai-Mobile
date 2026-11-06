import { describe, expect, it } from "vitest";
import { tabsFor } from "./tabs";

const keys = (role: "operator" | "manager") => tabsFor(role, "u1").map((tab) => tab.key);
const tab = (role: "operator" | "manager", key: string) =>
  tabsFor(role, "u1").find((item) => item.key === key)!;

describe("abas de conversas", () => {
  it("operador não tem as abas da empresa", () => {
    expect(keys("operator")).toEqual(["pending", "mine", "on_hold", "groups", "finished"]);
    expect(keys("manager")).toEqual(expect.arrayContaining(["ia", "all"]));
  });

  it("operador filtra pendentes e finalizadas pelas dele; gestor vê as da empresa", () => {
    expect(tab("operator", "pending").filters.assigned_agent_id).toBe("u1");
    expect(tab("manager", "pending").filters.assigned_agent_id).toBeUndefined();
    expect(tab("operator", "finished").filters.assigned_agent_id).toBe("u1");
    expect(tab("manager", "finished").filters.assigned_agent_id).toBeUndefined();
  });

  it("Minhas é sempre do próprio usuário, e grupo não filtra por dono", () => {
    expect(tab("manager", "mine").filters.assigned_agent_id).toBe("u1");
    expect(tab("operator", "groups").filters).toEqual({
      status: "pending,in_attendance,on_hold",
      is_group: true,
    });
  });
});
