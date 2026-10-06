import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getHotelProfile, upsertHotelProfile } from '@/lib/services/hotel.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim()));

const schema = z.object({
  name: z.string().min(1),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  propertyCode: z.string().min(1).optional(),
  roomCapacity: z.number().int().min(0).optional(),
  bedCapacity: z.number().int().min(0).nullish(),
  printName: optionalText(200),
  address: optionalText(500),
  phone: optionalText(60),
  email: optionalText(200).refine((v) => v == null || z.string().email().safeParse(v).success, {
    message: 'Invalid email',
  }),
  website: optionalText(200),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
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
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    const profile = await upsertHotelProfile(body);
    return jsonOk(serialize(profile));
  } catch (err) {
    return handleRouteError(err);
  }
}
