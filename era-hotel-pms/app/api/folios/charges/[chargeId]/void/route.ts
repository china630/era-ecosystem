import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { voidCharge } from '@/lib/services/folio.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { chargeId } = await params;
    const before = await prisma.folioCharge.findUnique({
      where: { id: chargeId },
      select: { id: true, amount: true, description: true, folioId: true },
    });
    const result = await voidCharge(chargeId);
    if (before) {
      await recordHotelAudit(
        { userId: session?.sub, request },
        'FolioCharge',
        chargeId,
        'VOID',
        { before, reservationId: result.reservationId },
      );
    }
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
