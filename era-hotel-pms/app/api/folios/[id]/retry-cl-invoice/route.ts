import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { issueFolioInvoice } from '@/lib/services/fiscal-document.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

/**
 * Re-issue City Ledger invoice for a folio stuck in PENDING_AR after a failed handoff.
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
    if (folio.status !== 'PENDING_AR' && folio.status !== 'TRANSFERRED_AR') {
      return Response.json(
        { error: 'Folio is not in a City Ledger handoff status', code: 'INVALID_STATUS' },
        { status: 409 },
      );
    }

    const doc = await issueFolioInvoice(folio.id);
    if (folio.status === 'PENDING_AR') {
      await prisma.folio.update({ where: { id: folio.id }, data: { status: 'TRANSFERRED_AR' } });
    }
    await prisma.reservation.updateMany({
      where: {
        id: folio.reservationId,
        checkoutSettlementStatus: { in: ['PENDING', 'NOT_APPLICABLE'] },
      },
      data: { checkoutSettlementStatus: 'INVOICED' },
    });

    return jsonOk(serialize({ folioId: folio.id, status: 'TRANSFERRED_AR', document: doc }));
  } catch (err) {
    return handleRouteError(err);
  }
}
