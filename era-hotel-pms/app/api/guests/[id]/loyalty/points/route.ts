import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  createGuestLoyaltyPoint,
  listGuestLoyaltyPoints,
} from '@/lib/services/guest-loyalty-points.service';

const postSchema = z.object({
  entryDate: z.string(),
  points: z.number(),
  description: z.string().nullable().optional(),
  balanceAfter: z.number().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await listGuestLoyaltyPoints(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = postSchema.parse(await request.json());
    return jsonOk(serialize(await createGuestLoyaltyPoint(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
