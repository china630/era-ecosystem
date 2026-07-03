import { z } from 'zod';
import { mergePersonRecords } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  guestId: z.string(),
  sourcePersonId: z.string().uuid(),
  targetPersonId: z.string().uuid(),
  fin: z.string().trim().min(7),
  fullName: z.string().trim().min(1),
  nationality: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    const merged = await mergePersonRecords(body.sourcePersonId, body.targetPersonId);
    if (!merged.globalPersonId) {
      throw new Error('MDM merge failed');
    }
    await prisma.guest.update({
      where: { id: body.guestId },
      data: { globalPersonId: merged.globalPersonId },
    });
    return jsonOk({ globalPersonId: merged.globalPersonId });
  } catch (err) {
    return handleRouteError(err);
  }
}
