import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyStayAmendment } from '@/lib/services/stay-amendment.service';

const schema = z.object({
  effectiveDate: z.coerce.date(),
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(
      await applyStayAmendment({
        reservationId: id,
        effectiveDate: body.effectiveDate,
        roomTypeId: body.roomTypeId,
        ratePlanId: body.ratePlanId,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
