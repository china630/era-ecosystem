import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listHkConsumption, saveHkConsumption } from '@/lib/services/hk-consumption.service';

const bodySchema = z.object({
  sku: z.string().min(1),
  qty: z.number().finite().refine((qty) => qty !== 0),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await listHkConsumption()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = bodySchema.parse(await request.json());
    const saved = await saveHkConsumption(body);
    return jsonOk(serialize(saved), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
