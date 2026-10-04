import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createLostFound, listLostFound, updateLostFoundStatus } from '@/lib/services/wave-b-master.service';

const schema = z.object({
  foundDate: z.coerce.date(),
  location: z.string().min(1),
  description: z.string().min(1),
  roomNumber: z.string().max(32).optional(),
  photoData: z.string().max(1_600_000).optional(),
  guestId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['OPEN', 'RETURNED', 'DISPOSED']),
});

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const guestId = new URL(req.url).searchParams.get('guestId') ?? undefined;
    return jsonOk(serialize(await listLostFound(guestId)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = statusSchema.parse(await request.json());
    return jsonOk(serialize(await updateLostFoundStatus(body.id, body.status)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    if (body.photoData && !body.photoData.startsWith('data:image/')) {
      body.photoData = undefined;
    }
    return jsonOk(serialize(await createLostFound(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
