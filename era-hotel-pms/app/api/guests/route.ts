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
    const params = new URL(request.url).searchParams;
    const q = params.get('q') ?? undefined;
    const pageRaw = params.get('page');
    const pageSizeRaw = params.get('pageSize');
    const result = await listGuests({
      q,
      page: pageRaw ? Number(pageRaw) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
      gender: params.get('gender') ?? undefined,
      nationality: params.get('nationality') ?? undefined,
      fin: params.get('fin') ?? undefined,
      passport: params.get('passport') ?? undefined,
      birthDateFrom: params.get('birthDateFrom') ?? undefined,
      birthDateTo: params.get('birthDateTo') ?? undefined,
      email: params.get('email') ?? undefined,
      phone: params.get('phone') ?? undefined,
      externalRef: params.get('externalRef') ?? undefined,
    });
    return jsonOk(serialize(result));
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
