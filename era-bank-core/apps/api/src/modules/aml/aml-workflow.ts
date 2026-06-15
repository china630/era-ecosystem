import { AmlAlertStatus } from "@era/bank-core-database";

const ALLOWED_TRANSITIONS: Record<AmlAlertStatus, AmlAlertStatus[]> = {
  [AmlAlertStatus.OPEN]: [
    AmlAlertStatus.UNDER_REVIEW,
    AmlAlertStatus.CLOSED,
    AmlAlertStatus.ESCALATED,
  ],
  [AmlAlertStatus.UNDER_REVIEW]: [AmlAlertStatus.CLOSED, AmlAlertStatus.ESCALATED],
  [AmlAlertStatus.CLOSED]: [],
  [AmlAlertStatus.ESCALATED]: [],
};

export function assertAlertStatusTransition(
  current: AmlAlertStatus,
  next: AmlAlertStatus,
): void {
  if (current === next) return;
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid AML alert transition: ${current} → ${next}`);
  }
}

export function canTransitionAlertStatus(
  current: AmlAlertStatus,
  next: AmlAlertStatus,
): boolean {
  if (current === next) return true;
  return (ALLOWED_TRANSITIONS[current] ?? []).includes(next);
}
