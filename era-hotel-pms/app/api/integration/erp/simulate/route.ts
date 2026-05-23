import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyE6FiscalStatusChanged } from '@/lib/services/fiscal-document.service';

const schema = z.object({
  invoiceRef: z.string().min(1),
  fiscalStatus: z.string().min(1),
  fiscalExternalId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    const doc = await applyE6FiscalStatusChanged({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return jsonOk(serialize({ applied: true, document: doc }));
  } catch (err) {
    return handleRouteError(err);
  }
}
