import { describe, expect, it } from "vitest";
import { homeFor, navItemsFor } from "./navigation";

describe("navegação por papel", () => {
  it("operador abre em Conversas e não vê os números da empresa", () => {
    expect(homeFor("operator")).toBe("/conversas");
    expect(navItemsFor("operator").map((item) => item.to)).toEqual(["/conversas", "/conta"]);
  });

  it("gestor e admin abrem em Agora e também veem Conversas", () => {
    for (const role of ["manager", "admin"] as const) {
      expect(homeFor(role)).toBe("/agora");
      expect(navItemsFor(role).map((item) => item.to)).toEqual(["/agora", "/conversas", "/conta"]);
    }
  });
});
