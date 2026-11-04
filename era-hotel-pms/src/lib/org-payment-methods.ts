import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { DESK_PAYMENT_METHODS, type DeskPaymentMethod } from '@/lib/desk-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';

/**
 * Desk tender codes for this hotel org.
 * After first Sync of org payment methods, the catalog is the only source.
 * Before Sync, fall back to the baked desk list (includes EPOINT).
 */
export function hotelDeskPaymentMethods(): string[] {
  const organizationId = requestOrganizationId();
  if (paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'hotel',
    }).map((row) => row.code);
  }
  return [...DESK_PAYMENT_METHODS];
}

export function hotelDeskPaymentOptions(locale: 'az' | 'ru' | 'en' = 'en'): Array<{
  value: string;
  label: string;
}> {
  const organizationId = requestOrganizationId();
  if (paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'hotel',
    }).map((row) => ({
      value: row.code,
      label: locale === 'az' ? row.nameAz : locale === 'ru' ? row.nameRu : row.nameEn,
    }));
  }
  return DESK_PAYMENT_METHODS.map((code) => ({ value: code, label: code }));
}

/** Guest-facing tenders (no CL / deposit as a settle line). */
export function hotelGuestTenders(): string[] {
  return hotelDeskPaymentMethods().filter(
    (code) =>
      code !== 'DEPOSIT' &&
      code !== 'CL_AGENCY' &&
      code !== 'CL_COMPANY' &&
      code !== 'COMPANY_ACCOUNT',
  );
}

export function assertHotelPaymentMethodAllowed(code: string): void {
  const allowed = hotelDeskPaymentMethods();
  if (!allowed.includes(code)) {
    throw Object.assign(new Error(`Payment method ${code} is not enabled for this hotel`), {
      status: 409,
      code: 'PAYMENT_METHOD_DISABLED',
    });
  }
}

export type { DeskPaymentMethod };
