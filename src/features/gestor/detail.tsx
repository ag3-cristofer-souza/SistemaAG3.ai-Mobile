import { AlertOctagon, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert, AlertTone } from "./alerts";

const STYLE: Record<AlertTone, { box: string; icon: LucideIcon; iconTone: string }> = {
  danger: { box: "bg-destructive/10", icon: AlertOctagon, iconTone: "text-destructive" },
  warning: { box: "bg-warning/10", icon: TriangleAlert, iconTone: "text-warning" },
  info: { box: "bg-muted", icon: Info, iconTone: "text-muted-foreground" },
};

/** Alertas em cartões coloridos, do mais grave para o mais leve (a ordem vem de quem monta a lista). */
export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="space-y-2" aria-label="Alertas">
      {alerts.map((alert, index) => {
        const style = STYLE[alert.tone];
        const Icon = style.icon;
        return (
          <li
            key={`${index}-${alert.title}`}
            className={cn("flex gap-2.5 rounded-xl px-3 py-2.5", style.box)}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", style.iconTone)} aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{alert.title}</p>
              {alert.detail && <p className="mt-0.5 text-muted-foreground">{alert.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Uma linha "rótulo: valor" das folhas de detalhe. */
export function DetailLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <dt className="w-28 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
