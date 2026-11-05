import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { handoffPendingCityLedger } from '@/lib/services/city-ledger-night-handoff.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

/**
 * Same rule as night audit: transfer this PENDING_AR folio only when Finance already has the VÖEN card.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const folio = await prisma.folio.findUnique({
      where: { id },
      select: { id: true, status: true, type: true, reservationId: true },
    });
    if (!folio) {
      return Response.json({ error: 'Folio not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    if (folio.type !== 'AGENCY' && folio.type !== 'COMPANY') {
      return Response.json(
        { error: 'Only agency or company folios can retry City Ledger invoice', code: 'INVALID_FOLIO' },
        { status: 409 },
      );
    }
    if (folio.status !== 'PENDING_AR') {
      return Response.json(
        { error: 'Folio is not waiting for the night City Ledger handoff', code: 'INVALID_STATUS' },
        { status: 409 },
      );
    }

    const lines = await handoffPendingCityLedger(todayBakuYmd(), folio.id);
    const failed = lines.find((line) => line.level === 'exception');
    if (failed) {
      return Response.json({ error: failed.message, code: 'CL_CARD_MISSING' }, { status: 409 });
    }
    return jsonOk(serialize({ folioId: folio.id, status: 'TRANSFERRED_AR', lines }));
  } catch (err) {
    return handleRouteError(err);
  }
}
