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

  it("só gestor e admin têm Dashboards", () => {
    expect(labels("operator")).toEqual(["Atendimento", "Conta"]);
    expect(labels("manager")).toEqual(["Atendimento", "Dashboards", "Conta"]);
    expect(labels("admin")).toEqual(["Atendimento", "Dashboards", "Conta"]);
  });
});
