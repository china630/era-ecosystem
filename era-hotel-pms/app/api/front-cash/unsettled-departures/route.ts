import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listUnsettledDepartures } from '@/lib/services/unsettled-departures.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['PENDING', 'INVOICED', 'SETTLED', 'ALL']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = new URL(request.url);
    const parsed = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const result = await listUnsettledDepartures(parsed);
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
