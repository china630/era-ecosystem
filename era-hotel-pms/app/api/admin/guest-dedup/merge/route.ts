import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  GuestDedupNeedsPersonMerge,
  mergeGuestCards,
} from '@/lib/services/guest-merge.service';

const schema = z.object({
  survivorId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1),
  confirmPersonMerge: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    const result = await mergeGuestCards(body);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof GuestDedupNeedsPersonMerge) {
      return Response.json(
        { error: err.message, needsPersonMerge: true },
        { status: 409 },
      );
    }
    return handleRouteError(err);
  }
}
