/** Alertas das folhas do Agora (canal e operador): tom e ordem comuns. */
export type AlertTone = "danger" | "warning" | "info";

export interface Alert {
  tone: AlertTone;
  title: string;
  detail?: string;
}

export const ALERT_ORDER: Record<AlertTone, number> = { danger: 0, warning: 1, info: 2 };

export const CHIP_TONE: Record<AlertTone, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-muted text-muted-foreground",
};
