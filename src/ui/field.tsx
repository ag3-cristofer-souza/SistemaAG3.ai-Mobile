import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Ícone decorativo à esquerda. */
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Field({ label, leading, trailing, className, ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        {leading && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground [&_svg]:size-[1.125rem]"
          >
            {leading}
          </div>
        )}
        <input
          id={id}
          className={cn(
            "min-h-12 w-full rounded-xl border border-input bg-background px-3.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
            leading ? "pl-11" : "",
            trailing ? "pr-12" : "",
            className
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
    </div>
  );
}
