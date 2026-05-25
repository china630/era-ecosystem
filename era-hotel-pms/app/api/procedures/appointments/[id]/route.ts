import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { finishAppointment, markNoShow } from '@/lib/services/procedure-schedule.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const finishSchema = z.object({
  action: z.enum(['finish', 'no_show']),
  auditNote: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const { id } = await params;
    const body = finishSchema.parse(await req.json());

    const result =
      body.action === 'finish'
        ? await finishAppointment(id, body.auditNote)
        : { appointment: await markNoShow(id), includedInPackage: false, folioChargeId: null };

    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
