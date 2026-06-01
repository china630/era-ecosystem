import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { handleOtaCancel } from '@/lib/services/channel.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const schema = z.object({ otaReference: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution');
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await handleOtaCancel(body.otaReference)));
  } catch (err) {
    return handleRouteError(err);
  }
}
