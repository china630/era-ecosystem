import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { saveStayLinenOverride } from '@/lib/services/hk-nafta.service';

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  linenEveryNights: z.number().int().min(1).max(30).nullable(),
  deepEveryNights: z.number().int().min(1).max(30).nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = bodySchema.parse(await request.json());
    return jsonOk(
      serialize(
        await saveStayLinenOverride(body.reservationId, body.linenEveryNights, body.deepEveryNights),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
