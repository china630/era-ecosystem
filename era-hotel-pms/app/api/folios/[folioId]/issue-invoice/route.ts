import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { issueFolioInvoice } from '@/lib/services/fiscal-document.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ folioId: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { folioId } = await params;
    const doc = await issueFolioInvoice(folioId);
    return jsonOk(serialize(doc));
  } catch (err) {
    return handleRouteError(err);
  }
}
