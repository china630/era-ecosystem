/**
 * PMS → era-fnb-pos lifecycle notifications (Stage 17).
 * No-op when FNB_POS_WEBHOOK_URL is unset.
 */

export type PmsReservationLifecycleEvent = {
  eventType: 'reservation_checked_out' | 'reservation_cancelled' | 'folio_closed';
  reservationId: string;
  roomNumber?: string | null;
  timestamp: string;
};

function fnbWebhookBaseUrl(): string | undefined {
  return (
    process.env.FNB_POS_WEBHOOK_URL ??
    process.env.FNB_POS_WEBHOOK_URL
  )?.replace(/\/$/, '');
}

export async function notifyFnbPosReservationLifecycle(
  event: PmsReservationLifecycleEvent,
): Promise<void> {
  const base = fnbWebhookBaseUrl();
  if (!base) return;

  const secret = process.env.POS_BRIDGE_SECRET;
  const url = `${base}/api/webhooks/pms/reservation-lifecycle`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Pos-Bridge-Secret': secret } : {}),
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('fnb-pos webhook failed', res.status, text);
    }
  } catch (e) {
    console.error('fnb-pos webhook error', e);
  }
}

/** @deprecated Use notifyFnbPosReservationLifecycle */
export const notifyFbPosReservationLifecycle = notifyFnbPosReservationLifecycle;
