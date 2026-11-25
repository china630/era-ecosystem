/** CBAR Central Credit Registry — debt status change submission window (P1-3). */

export const CBAR_DEBT_STATUS_DEADLINE_DAYS = 30;
export const CBAR_DEBT_STATUS_ALERT_DAYS = 25;

export type DebtStatusRegistryAlertLevel = "ok" | "warning" | "overdue";

export function debtStatusRegistryAlertLevel(daysPending: number): {
  level: DebtStatusRegistryAlertLevel;
  alert: boolean;
} {
  if (daysPending > CBAR_DEBT_STATUS_DEADLINE_DAYS) {
    return { level: "overdue", alert: true };
  }
  if (daysPending > CBAR_DEBT_STATUS_ALERT_DAYS) {
    return { level: "warning", alert: true };
  }
  return { level: "ok", alert: false };
}

export function daysBetweenUtc(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}