import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listCompanyTransferredFolios } from '@/lib/services/agency-settlement.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listCompanyTransferredFolios(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
