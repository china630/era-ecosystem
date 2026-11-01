import { requestOrganizationId } from '@/lib/request-organization';
import { prisma } from '@/lib/prisma';
import { voidCharge } from '@/lib/services/folio.service';
import { parseFolioChargeRef } from '@era/satellite-kit/integration/folio-charge-ref';

/**
 * Clear clinic plan for this stay, then drop matching hotel charges for cancelled
 * future / no-show rows. Fail closed when clinic is configured but unreachable.
 */
export async function assertClinicCheckoutClear(reservationId: string): Promise<void> {
  const base = (process.env.CLINIC_URL ?? process.env.ERA_CLINIC_URL ?? '').replace(/\/$/, '');
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
  if (!base || !token) return;

  const res = await fetch(`${base}/api/internal/v1/stay-procedures`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organizationId: requestOrganizationId(),
      reservationId,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  if (!res || !res.ok) {
    throw new Error('Clinic unavailable — cannot clear procedures for checkout');
  }

  const body = (await res.json()) as {
    data?: { cancelledOrderIds?: string[] };
    cancelledOrderIds?: string[];
  };
  const cancelled = new Set(body.data?.cancelledOrderIds ?? body.cancelledOrderIds ?? []);
  if (cancelled.size === 0) return;

  const folios = await prisma.folio.findMany({
    where: { reservationId, status: 'OPEN' },
    include: { charges: true },
  });
  for (const folio of folios) {
    for (const charge of folio.charges) {
      const ref = parseFolioChargeRef(charge.externalRef);
      if (ref?.source !== 'clinic' || !ref.orderId) continue;
      if (!cancelled.has(ref.orderId)) continue;
      try {
        await voidCharge(charge.id, 'Checkout — future / no-show procedure cleared', undefined);
      } catch {
        // Charge may already be gone after clinic void path; continue.
      }
    }
  }
}
