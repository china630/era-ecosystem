import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { dispatchCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { prisma } from '@/lib/prisma';

const postSchema = z.object({
  asOfDate: z.string().min(8).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSessionFromHeaders(), PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    const last = await prisma.satelliteAuditLog.findFirst({
      where: { entityType: 'CityLedgerSnapshot', entityId: id },
      orderBy: { createdAt: 'desc' },
    });
    return jsonOk({
      agencyId: id,
      lastSnapshot: last
        ? {
            at: last.createdAt,
            action: last.action,
            changes: last.changesJson ? JSON.parse(last.changesJson) : null,
          }
        : null,
      financeSalesInvoicesUrl: process.env.NEXT_PUBLIC_FINANCE_WEB_URL
        ? `${process.env.NEXT_PUBLIC_FINANCE_WEB_URL.replace(/\/$/, '')}/sales/invoices`
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = postSchema.parse(await request.json().catch(() => ({})));
    const asOfDate = body.asOfDate ?? new Date().toISOString().slice(0, 10);
    const result = await dispatchCityLedgerSnapshot(id, asOfDate);
    await recordHotelAudit(
      { userId: session?.sub, request },
      'CityLedgerSnapshot',
      id,
      'PUSH',
      { asOfDate, result },
    );
    return jsonOk({ ok: true, asOfDate, result });
  } catch (err) {
    return handleRouteError(err);
  }
}
