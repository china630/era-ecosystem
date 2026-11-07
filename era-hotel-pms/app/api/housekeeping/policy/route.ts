import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getHkHotelPolicy, saveHkHotelPolicy } from '@/lib/services/hk-nafta.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await getHkHotelPolicy()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  linenEveryNights: z.number().int().min(1).max(30),
  deepEveryNights: z.number().int().min(1).max(30),
  laundryExpressEnabled: z.boolean().optional(),
  laundryIntakeMode: z.enum(['ANY', 'WINDOW']).optional(),
  laundryIntakeStartHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryIntakeEndHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryClosedDays: z
    .enum(['ALL', 'EXCEPT_SUNDAY', 'EXCEPT_CALENDAR', 'EXCEPT_SUNDAY_AND_CALENDAR'])
    .optional(),
  laundryDueMode: z.enum(['NONE', 'BY_HOUR']).optional(),
  laundryDueCutoffHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryDueAtHour: z.number().int().min(0).max(23).nullable().optional(),
  egPressureFrom: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    if (body.laundryIntakeMode === 'WINDOW') {
      if (body.laundryIntakeStartHour == null || body.laundryIntakeEndHour == null) {
        return Response.json(
          { error: 'Intake window requires start and end hour' },
          { status: 400 },
        );
      }
      if (body.laundryIntakeStartHour >= body.laundryIntakeEndHour) {
        return Response.json({ error: 'Intake start must be before end' }, { status: 400 });
      }
    }
    return jsonOk(
      serialize(
        await saveHkHotelPolicy(body.linenEveryNights, body.deepEveryNights, {
          laundryExpressEnabled: body.laundryExpressEnabled,
          laundryIntakeMode: body.laundryIntakeMode,
          laundryIntakeStartHour: body.laundryIntakeStartHour,
          laundryIntakeEndHour: body.laundryIntakeEndHour,
          laundryClosedDays: body.laundryClosedDays,
          laundryDueMode: body.laundryDueMode,
          laundryDueCutoffHour: body.laundryDueCutoffHour,
          laundryDueAtHour: body.laundryDueAtHour,
          egPressureFrom: body.egPressureFrom,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
