import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { confirmBanquetEvent, getBanquetEvent } from '@/lib/services/banquet.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  action: z.enum(['confirm']),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getBanquetEvent(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    if (body.action === 'confirm') {
      return jsonOk(serialize(await confirmBanquetEvent(id)));
    }

    return jsonOk(serialize(await getBanquetEvent(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
