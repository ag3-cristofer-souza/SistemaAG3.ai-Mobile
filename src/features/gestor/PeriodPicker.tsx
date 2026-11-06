import { cn } from "@/lib/utils";
import { PERIODS, type PeriodKey } from "./period";

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
    >
      {PERIODS.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
          className={cn(
            "min-h-10 rounded-md text-xs",
            item.key === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
