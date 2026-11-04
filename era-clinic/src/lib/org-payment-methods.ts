import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';

const FALLBACK = ['CASH', 'CARD', 'TRANSFER', 'BANK_TRANSFER'] as const;

export function clinicDeskPaymentMethods(): string[] {
  const organizationId = requestOrganizationId();
  if (paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'clinic',
    }).map((row) => row.code);
  }
  return [...FALLBACK];
}

export function assertClinicPaymentMethodAllowed(code: string): void {
  if (!clinicDeskPaymentMethods().includes(code)) {
    throw Object.assign(new Error(`Payment method ${code} is not enabled for this clinic`), {
      status: 409,
      code: 'PAYMENT_METHOD_DISABLED',
    });
  }
}
