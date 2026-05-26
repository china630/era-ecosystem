import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { createBookingSlot } from '@/integration/control-plane-platform.client';

const bodySchema = z.object({
  resourceKey: z.string().min(1).max(64).default('spa-cabin-1'),
  resourceName: z.string().max(256).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
    if (!organizationId) {
      return jsonOk({ skipped: true, reason: 'ERA_SATELLITE_ORGANIZATION_ID not set' });
    }

    const slot = await createBookingSlot(
      {
        resourceKey: body.resourceKey,
        resourceName: body.resourceName ?? `SPA ${body.resourceKey}`,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        capacity: body.capacity ?? 1,
      },
      { organizationId },
    );

    return jsonOk(slot);
  } catch (err) {
    return handleRouteError(err);
  }
}
