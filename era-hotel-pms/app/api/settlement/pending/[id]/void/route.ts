import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { voidPendingCharge } from '@/lib/services/settlement-hub.service';

const schema = z.object({
  reason: z.string().min(3),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const voided = await voidPendingCharge(id, body.reason);
    return jsonOk(serialize(voided));
  } catch (err) {
    return handleRouteError(err);
  }
}
