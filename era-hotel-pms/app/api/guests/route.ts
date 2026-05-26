import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createGuest, listGuests } from '@/lib/services/guest.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  fullName: z.string().min(1),
  voen: z.string().nullable().optional(),
  passportNumber: z.string().min(1),
  phone: z.string().min(1),
  globalPersonId: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const guests = await listGuests();
    return jsonOk(serialize(guests));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    const guest = await createGuest(body);
    return jsonOk(serialize(guest), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
