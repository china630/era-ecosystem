import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createGuestTimeShare, listGuestTimeShares } from '@/lib/services/guest-aux.service';

const schema = z.object({
  contractNo: z.string(),
  unitCode: z.string().optional(),
  weekNo: z.number().int().optional(),
  status: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await listGuestTimeShares(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createGuestTimeShare(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
