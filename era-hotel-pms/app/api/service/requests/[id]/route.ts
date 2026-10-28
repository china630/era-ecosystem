import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from '@/lib/auth/session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { updateServiceRequestStatus } from '@/lib/services/service-work-order.service';

const patchSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DONE', 'CANCELLED']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError('Unauthorized', 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const row = await updateServiceRequestStatus(id, body.status);
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
