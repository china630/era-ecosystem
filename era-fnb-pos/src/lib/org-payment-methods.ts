import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';

const FALLBACK = ['CASH', 'CARD', 'TRANSFER'] as const;

export function fnbDeskPaymentMethods(): string[] {
  const organizationId = requestOrganizationId();
  if (paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'fnb',
    }).map((row) => row.code);
  }
  return [...FALLBACK];
}

export function assertFnbPaymentMethodAllowed(code: string): void {
  if (!fnbDeskPaymentMethods().includes(code)) {
    throw Object.assign(new Error(`Payment method ${code} is not enabled for this outlet`), {
      status: 409,
      code: 'PAYMENT_METHOD_DISABLED',
    });
  }
}
