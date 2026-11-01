import type { RevenueCodeRole } from '@/lib/revenue-code-match';
import { isRevenueCodeRole } from '@/lib/revenue-code-match';

/** Cashier payment / folio rollup category (not GL reportType). */
export const PAYMENT_CATEGORIES = ['LODGING', 'CLINIC', 'FB', 'OTHER'] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export function isPaymentCategory(value: unknown): value is PaymentCategory {
  return typeof value === 'string' && (PAYMENT_CATEGORIES as readonly string[]).includes(value);
}

/** First-fill map from systemRole → paymentCategory. Editable on the code afterward. */
const ROLE_DEFAULT: Partial<Record<RevenueCodeRole, PaymentCategory>> = {
  ROOM: 'LODGING',
  PKG: 'LODGING',
  RATE_ADJ: 'LODGING',
  BOARD: 'LODGING',
  EARLY_CI: 'LODGING',
  LATE_CO: 'LODGING',
  CITY_TAX: 'LODGING',
  CXL_NOSHOW: 'LODGING',
  DISCOUNT: 'LODGING',
  PROCEDURE: 'CLINIC',
  DOCTOR: 'CLINIC',
  DIAGNOSTIC: 'CLINIC',
  LAB: 'CLINIC',
  PHARMA: 'CLINIC',
  TREATMENT: 'CLINIC',
  SPA: 'CLINIC',
  MEDICAL: 'CLINIC',
  CLINIC_DISCOUNT: 'CLINIC',
  FOOD: 'FB',
  BEVERAGE: 'FB',
  ALCOHOL: 'FB',
  TOBACCO: 'FB',
  MINIBAR: 'FB',
  FB_DISCOUNT: 'FB',
  LAUNDRY: 'OTHER',
  TRANSFER: 'OTHER',
  TAXI: 'OTHER',
  TOUR: 'OTHER',
  BANQUET: 'OTHER',
  PARKING: 'OTHER',
  HALL: 'OTHER',
  ENTERTAINMENT: 'OTHER',
  DAMAGE: 'OTHER',
  OTHER: 'OTHER',
  TELECOM: 'OTHER',
  RESORT_FEE: 'OTHER',
};

export function defaultPaymentCategoryForRole(
  systemRole: string | null | undefined,
): PaymentCategory | null {
  if (!systemRole || !isRevenueCodeRole(systemRole)) return null;
  return ROLE_DEFAULT[systemRole] ?? null;
}

export function resolvePaymentCategory(row: {
  paymentCategory?: string | null;
  systemRole?: string | null;
  revenueCode?: { paymentCategory?: string | null; systemRole?: string | null } | null;
}): PaymentCategory | null {
  const direct = row.paymentCategory ?? row.revenueCode?.paymentCategory;
  if (isPaymentCategory(direct)) return direct;
  return defaultPaymentCategoryForRole(row.systemRole ?? row.revenueCode?.systemRole);
}
