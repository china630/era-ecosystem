import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listSyncErrors, logSyncError, resolveSyncError } from '@/lib/services/channel.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    return jsonOk(serialize(await listSyncErrors()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  reservationId: z.string().uuid().optional(),
  otaReference: z.string().optional(),
  errorMessage: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await logSyncError(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('id query required');
    return jsonOk(serialize(await resolveSyncError(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
