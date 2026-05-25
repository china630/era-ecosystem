import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createAppointment } from '@/lib/services/procedure-schedule.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffName: z.string().optional(),
  placeCode: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = bodySchema.parse(await req.json());
    const created = await createAppointment({
      ...body,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });
    return jsonOk(serialize(created));
  } catch (err) {
    return handleRouteError(err);
  }
}
