import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { parseCardValue } from "./money";

/** Campo do valor da venda do card (MOB-03), no painel do funil e no finalizar. */
export function CardValueField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
  const invalid = parseCardValue(value) === null;
  return (
    <div className="space-y-1.5">
      <Field
        label="Valor da venda (R$)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <ErrorText>{invalid && "Use números, com vírgula nos centavos (ex.: 1.500,00)."}</ErrorText>
    </div>
  );
}
