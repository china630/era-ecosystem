import type { SalesContractStatus } from '@prisma/client';

/** Allowed status transitions (no reopen in this edition). */
const STATUS_TRANSITIONS: Record<SalesContractStatus, SalesContractStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
};

export function assertSalesContractStatusTransition(
  from: SalesContractStatus,
  to: SalesContractStatus,
): void {
  if (from === to) return;
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Cannot change sales contract status from ${from} to ${to}`),
      { status: 400 },
    );
  }
}
