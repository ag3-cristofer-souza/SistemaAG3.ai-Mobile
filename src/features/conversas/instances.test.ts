import { describe, expect, it } from "vitest";
import { instanceLabel } from "./instances";

const INSTANCES = [
  { id: "AAA-1", display_name: "Comercial", number: "5511911112222" },
  { id: "bbb-2", display_name: null, name: null, number: "5511933334444" },
];

describe("instância da conversa", () => {
  it("acha pelo id, sem diferenciar maiúsculas", () => {
    expect(instanceLabel({ connected_instance_id: "aaa-1" }, INSTANCES)).toBe("Comercial");
  });

  it("conversa antiga, só com o número, acha a instância pelo número", () => {
    expect(instanceLabel({ connected_phone: "+55 11 91111-2222" }, INSTANCES)).toBe("Comercial");
  });

  it("instância sem nome aparece pelo número dela", () => {
    expect(instanceLabel({ connected_instance_id: "bbb-2" }, INSTANCES)).toBe("(11) 93333-4444");
  });

  it("instância fora da lista desta pessoa aparece pelo número da conversa", () => {
    expect(
      instanceLabel({ connected_instance_id: "zzz", connected_phone: "5511955556666" }, INSTANCES)
    ).toBe("(11) 95555-6666");
    expect(instanceLabel({ connected_phone: "5511955556666" }, undefined)).toBe("(11) 95555-6666");
  });

  it("sem id nem número, não mostra nada", () => {
    expect(instanceLabel({}, INSTANCES)).toBeNull();
  });
});
