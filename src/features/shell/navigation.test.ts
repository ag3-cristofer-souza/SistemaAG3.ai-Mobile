import { describe, expect, it } from "vitest";
import { homeFor, navItemsFor } from "./navigation";

const labels = (role: "operator" | "manager" | "admin") =>
  navItemsFor(role).map((item) => item.label);

describe("navegação por papel", () => {
  it("todos abrem no Atendimento", () => {
    for (const role of ["operator", "manager", "admin"] as const) {
      expect(homeFor(role)).toBe("/conversas");
    }
  });

  it("só gestor e admin têm Dashboards; operador vê os próprios números", () => {
    expect(labels("operator")).toEqual(["Atendimento", "Calendário", "Meus números", "Conta"]);
    expect(labels("manager")).toEqual(["Atendimento", "Calendário", "Dashboards", "Conta"]);
    expect(labels("admin")).toEqual(["Atendimento", "Calendário", "Dashboards", "Conta"]);
  });
});
