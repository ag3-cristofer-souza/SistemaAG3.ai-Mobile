import { describe, expect, it } from "vitest";
import {
  buildStages,
  cardAccess,
  focusCard,
  historyDetail,
  historyLabel,
  isCustomPipeline,
  stageLabel,
  withCurrentStage,
} from "./funnel";

const keys = (list: Array<{ key: string }>) => list.map((item) => item.key);

describe("etapas do funil", () => {
  it("funil padrão junta sistema, criadas e integrações, sem as ocultas", () => {
    const stages = buildStages(
      [
        { key: "pending", label: "Na fila", position: 2 },
        { key: "proposta", label: "Proposta", position: 20 },
        { key: "service_panel", label: "Painel", position: 0 },
      ],
      false,
      ["Simplifica X", "proposta"]
    );
    expect(stageLabel(stages, "pending")).toBe("Na fila");
    expect(keys(stages)).toContain("converted");
    expect(keys(stages)).toContain("proposta");
    expect(keys(stages)).not.toContain("service_panel");
    expect(keys(stages).indexOf("Simplifica X")).toBe(keys(stages).indexOf("pending") + 1);
    expect(keys(stages).filter((key) => key === "proposta")).toHaveLength(1);
  });

  it("funil personalizado mostra só as etapas dele, em ordem", () => {
    const stages = buildStages(
      [
        { key: "b", label: "B", position: 2 },
        { key: "a", label: "A", position: 1 },
      ],
      true,
      ["outra"]
    );
    expect(keys(stages)).toEqual(["a", "b"]);
  });

  it("reconhece o funil personalizado", () => {
    const pipelines = [
      { id: "p1", is_default: true },
      { id: "p2", is_default: false },
    ];
    expect(isCustomPipeline("p2", pipelines)).toBe(true);
    expect(isCustomPipeline("p1", pipelines)).toBe(false);
    expect(isCustomPipeline(null, pipelines)).toBe(false);
  });

  it("mantém na lista a etapa atual que saiu do funil", () => {
    expect(keys(withCurrentStage([{ key: "a", label: "A" }], "velha"))).toEqual(["a", "velha"]);
    expect(withCurrentStage([{ key: "a", label: "A" }], "a")).toHaveLength(1);
    expect(stageLabel([], null)).toBe("Sem etapa");
  });
});

describe("card da conversa", () => {
  const meu = { id: "meu", assigned_to: "u1" };
  const semDono = { id: "sem", assigned_to: null };
  const outro = { id: "outro", assigned_to: "u2" };
  const fechado = { id: "fechado", assigned_to: "u1", closed_at: "2026-11-06T12:00:00Z" };

  it("prefere o aberto dele, depois o sem dono, depois o aberto mais recente", () => {
    expect(focusCard([outro, semDono, meu], "u1")?.id).toBe("meu");
    expect(focusCard([outro, semDono], "u1")?.id).toBe("sem");
    expect(focusCard([outro], "u1")?.id).toBe("outro");
  });

  it("sem card aberto, mostra o fechado mais recente; sem card, nada", () => {
    expect(focusCard([fechado], "u1")?.id).toBe("fechado");
    expect(focusCard([fechado, semDono], "u1")?.id).toBe("sem");
    expect(focusCard([], "u1")).toBeNull();
  });

  it("quem pode mover", () => {
    expect(cardAccess(meu, "u1", false)).toBe("move");
    expect(cardAccess(semDono, "u1", true)).toBe("assume");
    expect(cardAccess(outro, "u1", false)).toBe("other");
    expect(cardAccess(outro, "u1", true)).toBe("move");
  });
});

describe("histórico do lead", () => {
  it("traduz o tipo e mostra a mudança", () => {
    expect(historyLabel("card_etapa")).toBe("Etapa alterada");
    expect(historyLabel("novo_tipo")).toBe("Atualização");
    expect(historyDetail({ from_label: "Pendente", to_label: "Convertido" })).toBe(
      "Pendente → Convertido"
    );
    expect(historyDetail({ from_label: null, to_label: "Ana" })).toBe("Ana");
    expect(historyDetail({ from_label: null, to_label: null })).toBe("");
  });
});
