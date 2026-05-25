import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { setInvoiceIntegrateFlag } from '@/lib/services/invoice-report.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  integrateToAccounting: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const updated = await setInvoiceIntegrateFlag(id, body.integrateToAccounting);
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
