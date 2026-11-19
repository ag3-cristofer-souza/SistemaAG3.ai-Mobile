/**
 * Valor da venda do card (`lead_produtos.total_value` no servidor: 2 casas, até 14 dígitos). É o mesmo campo do card no
 * board do painel, então o que se grava aqui aparece lá (MOB-03).
 */
export const MAX_CARD_VALUE = 999_999_999_999.99;

/** "R$ 1.500,00"; sem valor (nulo ou zero), nada. */
export function formatCardValue(value: number | null | undefined): string | null {
  if (!value) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** O valor como aparece no campo, para editar: "1.500,00". Zero ou nulo, campo vazio. */
export function cardValueInput(value: number | null | undefined): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * O que a pessoa digitou, em reais. Aceita o jeito brasileiro ("1.500,50", "R$ 1500,5") e o teclado com ponto
 * ("1500.50"); "1.500" sem vírgula é mil e quinhentos. Vazio = zero (limpa o valor). Inválido = null.
 */
export function parseCardValue(text: string): number | null {
  const raw = text.replace(/R\$|\s/g, "");
  if (!raw) return 0;
  let normal: string;
  if (raw.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(raw)) return null;
    normal = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normal = raw.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(raw)) {
    normal = raw;
  } else {
    return null;
  }
  const value = Math.round(Number(normal) * 100) / 100;
  return Number.isFinite(value) && value <= MAX_CARD_VALUE ? value : null;
}
