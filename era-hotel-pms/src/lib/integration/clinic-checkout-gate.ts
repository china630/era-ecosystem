import { requestOrganizationId } from '@/lib/request-organization';

/** Refuse checkout while a paid clinic procedure is still only planned. */
export async function assertClinicCheckoutClear(reservationId: string): Promise<void> {
  const base = (process.env.CLINIC_URL ?? process.env.ERA_CLINIC_URL ?? '').replace(/\/$/, '');
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
  if (!base || !token) return;
  const qs = new URLSearchParams({
    organizationId: requestOrganizationId(),
    reservationId,
  });
  const res = await fetch(`${base}/api/internal/v1/stay-procedures?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return;
  const body = (await res.json()) as { data?: { blocksCheckout?: boolean }; blocksCheckout?: boolean };
  const blocked = body.data?.blocksCheckout ?? body.blocksCheckout;
  if (blocked) {
    throw new Error('Paid procedures are still planned. Remove them before checkout.');
  }
}
