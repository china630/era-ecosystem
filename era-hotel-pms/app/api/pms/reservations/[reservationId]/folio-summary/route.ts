import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getFolioSummaryForPos } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_READ);
    const { reservationId } = await params;
    return jsonOk(serialize(await getFolioSummaryForPos(reservationId)));
  } catch (err) {
    return handleRouteError(err);
  }
}
