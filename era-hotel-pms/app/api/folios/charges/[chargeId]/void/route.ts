import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { voidCharge } from '@/lib/services/folio.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { chargeId } = await params;
    return jsonOk(serialize(await voidCharge(chargeId)));
  } catch (err) {
    return handleRouteError(err);
  }
}
