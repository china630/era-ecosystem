import { NextResponse } from 'next/server';
import { trySendPlatformNotification } from '@era/satellite-kit';

/**
 * v1.1 — scheduled email reports hook (WA0345+).
 * Invoke via external cron: POST /api/admin/reports/email-cron?secret=...
 */
/** SEC-HOT-02: no default cron secret in production */
export async function POST(req: Request) {
  const configured = process.env.HOTEL_EMAIL_CRON_SECRET?.trim();
  const secret =
    configured ||
    (process.env.NODE_ENV === 'production' ? '' : 'hotel-email-cron-dev');
  const url = new URL(req.url);
  if (!secret || url.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const to = process.env.HOTEL_REPORT_EMAIL_TO ?? 'manager@demo.local';
  await trySendPlatformNotification({
    templateKey: 'hotel_daily_ops',
    channel: 'EMAIL',
    messageClass: 'TRANSACTIONAL',
    recipient: to,
    sourceEntityType: 'hotel_daily_report',
    sourceEntityId: new Date().toISOString().slice(0, 10),
    subject: 'ERA Hotel — daily ops report',
    body: `Automated report ${new Date().toISOString().slice(0, 10)}`,
  });
  const result = { queued: true, recipient: to };

  return NextResponse.json({
    ok: true,
    sentAt: new Date().toISOString(),
    notification: result,
  });
}
