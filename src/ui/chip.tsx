import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  violet: "bg-violet-100 text-violet-700",
} as const;

export type ChipTone = keyof typeof TONES;

/** Etiqueta curta (canal, operador, situação). O texto é o que vale: a cor só ajuda a achar. */
export function Chip({
  icon: Icon,
  tone = "neutral",
  className,
  children,
}: {
  icon?: LucideIcon;
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium leading-4",
        TONES[tone],
        className
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
