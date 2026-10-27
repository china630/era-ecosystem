import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getTourOpsPolicy, saveTourOpsPolicy } from '@/lib/services/tour-ops-policy.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.RESERVATIONS_WRITE, PERMISSIONS.MASTER_DATA_MANAGE]);
    await requireHotelModule('hotel_transfers', session.organizationId);
    return jsonOk(serialize(await getTourOpsPolicy(session.organizationId)));
  } catch (e) {
    return handleRouteError(e);
  }
}

const patchSchema = z.object({
  chargeMode: z.enum(['CHARGE_ON_BOARDING', 'CHARGE_ON_ADD']).optional(),
  boardingCloseMode: z.enum(['MANUAL', 'AUTO_CUTOFF']).optional(),
  autoCutoffMinutesBeforePickup: z.number().int().positive().nullable().optional(),
  allowOverbook: z.boolean().optional(),
  dropUnboardedOnClose: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const body = patchSchema.parse(await req.json());
    return jsonOk(serialize(await saveTourOpsPolicy(body, session.organizationId)));
  } catch (e) {
    return handleRouteError(e);
  }
}
