import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import {
  confirmAgencyInboxItem,
  declineAgencyInboxItem,
  listAgencyInbox,
} from '@/lib/services/agency-portal.service';

export async function GET() {
  try {
    await requireHotelModule('hotel_core');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    return jsonOk(serialize(await listAgencyInbox()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const actionSchema = z.object({
  reservationId: z.string().uuid(),
  action: z.enum(['confirm', 'decline']),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireHotelModule('hotel_core');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = actionSchema.parse(await request.json());
    if (body.action === 'confirm') {
      return jsonOk(serialize(await confirmAgencyInboxItem(body.reservationId)));
    }
    return jsonOk(
      serialize(await declineAgencyInboxItem(body.reservationId, body.reason)),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
