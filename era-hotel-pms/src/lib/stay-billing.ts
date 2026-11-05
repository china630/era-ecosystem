/** Compliment and house-use stay billing. Room nights are zero; house use also nets extras. */

import { revenueRoleIn, STAY_NIGHT_ROLES } from '@/lib/revenue-code-match';

export type StayBillingMode = 'NORMAL' | 'COMP' | 'HOUSE';

export function isFreeStayBilling(mode: string | null | undefined): boolean {
  return mode === 'COMP' || mode === 'HOUSE';
}

/** House use posts the charge, then an offset so the guest balance stays zero. */
export function shouldOffsetHouseUse(input: {
  billingMode: string | null | undefined;
  amount: number;
  externalRef?: string | null;
}): boolean {
  if (input.billingMode !== 'HOUSE') return false;
  if (!(input.amount > 0)) return false;
  return !(input.externalRef ?? '').startsWith('house-use:');
}

/** Marker on the credit that nets a charge already posted before the stay became free. */
export function freeStayOffsetRef(chargeId: string, mode: 'COMP' | 'HOUSE'): string {
  return mode === 'HOUSE' ? `house-use:${chargeId}` : `comp-stay:${chargeId}`;
}

/**
 * Compliment credits lodging already on the folio. House use credits every open charge.
 * A second pass sees the marker and does nothing.
 */
export function chargeNeedsFreeStayOffset(input: {
  billingMode: string | null | undefined;
  systemRole: string | null;
  amount: number;
  externalRef?: string | null;
  chargeId: string;
  existingRefs: ReadonlySet<string>;
}): boolean {
  if (input.billingMode !== 'COMP' && input.billingMode !== 'HOUSE') return false;
  if (!(input.amount > 0.009)) return false;
  const ref = input.externalRef ?? '';
  if (ref.startsWith('house-use:') || ref.startsWith('comp-stay:') || ref.startsWith('void-')) return false;
  if (input.billingMode === 'COMP' && !revenueRoleIn({ systemRole: input.systemRole }, STAY_NIGHT_ROLES)) {
    return false;
  }
  if (input.existingRefs.has(`house-use:${input.chargeId}`)) return false;
  if (input.existingRefs.has(`comp-stay:${input.chargeId}`)) return false;
  return true;
}

/** Day-document quantity purpose. Compliment extras stay a sale; the stay night does not. */
export function dayQtyPurpose(
  billingMode: string | null | undefined,
  amount: number,
  systemRole: string | null,
): 'sale' | 'house_use' | 'comp' {
  if (billingMode === 'HOUSE') return 'house_use';
  const lodging = revenueRoleIn({ systemRole }, STAY_NIGHT_ROLES);
  if (billingMode === 'COMP' && (amount === 0 || lodging)) return 'comp';
  return 'sale';
}
