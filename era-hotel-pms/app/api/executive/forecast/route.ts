import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getOccupancyForecast } from '@/lib/services/forecast.service';

const querySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .optional()
    .default(14)
    .refine((d) => [7, 14, 30, 90].includes(d), {
      message: 'days must be 7, 14, 30, or 90',
    }),
});

export async function GET(request: Request) {
  try {
    assertAnyPermission(await getSessionFromHeaders(), [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { days } = querySchema.parse(params);
    return jsonOk(serialize(await getOccupancyForecast(days)));
  } catch (err) {
    return handleRouteError(err);
  }
}
