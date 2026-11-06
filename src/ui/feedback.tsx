import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FullScreenLoader({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-background" role="status">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorText({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-sm text-destructive", className)}>
      {children}
    </p>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-xs text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
