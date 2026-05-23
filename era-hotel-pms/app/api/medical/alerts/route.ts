import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createAlert, listAlerts } from '@/lib/services/medical.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  guestId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  temperature: z.number().optional(),
  message: z.string().min(1),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    return jsonOk(serialize(await listAlerts(false)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createAlert(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
