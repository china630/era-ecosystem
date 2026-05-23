import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getOccupancyGrid } from '@/lib/services/occupancy.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const querySchema = z.object({
  from: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(90).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { from, days } = querySchema.parse(params);

    return jsonOk(serialize(await getOccupancyGrid({ from, days })));
  } catch (err) {
    return handleRouteError(err);
  }
}
