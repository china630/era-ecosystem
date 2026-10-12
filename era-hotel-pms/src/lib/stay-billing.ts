/** Compliment and house-use stay billing. Room nights are zero; house use also nets extras. */

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
