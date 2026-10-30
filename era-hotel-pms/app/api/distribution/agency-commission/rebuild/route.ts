import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  rebuildCheckedOutForOrg,
  rebuildStay,
} from '@/lib/services/agency-commission.service';

const schema = z.object({
  reservationId: z.string().min(1).optional(),
  agencyId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json().catch(() => ({})));
    if (body.reservationId) {
      return jsonOk(await rebuildStay(body.reservationId));
    }
    return jsonOk(await rebuildCheckedOutForOrg({ agencyId: body.agencyId }));
  } catch (err) {
    return handleRouteError(err);
  }
}
