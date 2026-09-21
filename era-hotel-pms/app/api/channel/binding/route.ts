import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import {
  getChannelManagerBinding,
  upsertChannelManagerBinding,
} from '@/lib/channel/channel-manager-binding.service';

const upsertSchema = z.object({
  provider: z.enum(['off', 'stub', 'webhook', 'channex']).optional(),
  channexPropertyId: z.string().nullable().optional(),
  propertyType: z.enum(['hotel', 'vacation_rental']).optional(),
  live: z.boolean().optional(),
  ibeAllowedOrigins: z.array(z.string()).optional(),
  webhookSecret: z.string().nullable().optional(),
  rotateIbeKey: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireHotelModule('hotel_distribution');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const binding = await getChannelManagerBinding();
    return jsonOk(
      binding ?? {
        organizationId: null,
        provider: 'off',
        channexPropertyId: null,
        propertyType: 'hotel',
        live: false,
        ibePublishableKey: null,
        ibeAllowedOrigins: [],
        hasWebhookSecret: false,
      },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    await requireHotelModule('hotel_distribution');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const body = upsertSchema.parse(await request.json());
    const binding = await upsertChannelManagerBinding(body);
    return jsonOk(binding);
  } catch (err) {
    return handleRouteError(err);
  }
}
