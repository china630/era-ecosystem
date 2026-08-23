import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createFleetVehicle, listFleetVehicles } from '@/lib/services/fleet.service';

const bodySchema = z.object({
  code: z.string().min(1),
  brand: z.string().min(1),
  licensePlate: z.string().min(1),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  maxSeats: z.number().int().positive(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    return jsonOk(serialize(await listFleetVehicles()));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const body = bodySchema.parse(await req.json());
    return jsonOk(serialize(await createFleetVehicle(body)), 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
