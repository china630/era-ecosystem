import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createGuestSchema } from '@/lib/guest-input';
import { createGuest, listGuests } from '@/lib/services/guest.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const q = new URL(request.url).searchParams.get('q') ?? undefined;
    const guests = await listGuests(q ?? undefined);
    return jsonOk(serialize(guests));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createGuestSchema.parse(await request.json());
    const guest = await createGuest(body);
    return jsonOk(serialize(guest), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
