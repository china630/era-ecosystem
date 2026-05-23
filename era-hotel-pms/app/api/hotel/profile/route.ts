import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getHotelProfile, upsertHotelProfile } from '@/lib/services/hotel.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  name: z.string().min(1),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  propertyCode: z.string().min(1),
  roomCapacity: z.number().int().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertAnyPermission(session, [
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.REPORTS_READ,
    ]);
    const profile = await getHotelProfile();
    return jsonOk(serialize(profile));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    const profile = await upsertHotelProfile(body);
    return jsonOk(serialize(profile));
  } catch (err) {
    return handleRouteError(err);
  }
}
