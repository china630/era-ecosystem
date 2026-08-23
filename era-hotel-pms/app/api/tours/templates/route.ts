import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createTourTemplate, listTourTemplates } from '@/lib/services/tour.service';

const bodySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultAgenda: z.string().optional(),
  defaultPickup: z.string().optional(),
  defaultReturn: z.string().optional(),
  defaultCapacity: z.number().int().positive().optional(),
  defaultPrice: z.number().nonnegative(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    return jsonOk(serialize(await listTourTemplates(false)));
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
    return jsonOk(serialize(await createTourTemplate(body)), 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
