import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { ingestMinibarSensorEvent } from '@/lib/services/minibar-iot.service';

const schema = z.object({
  roomNumber: z.string().min(1),
  sensorId: z.string().optional(),
  itemCode: z.string().min(1),
  deltaQty: z.number().int().optional(),
  raw: z.record(z.unknown()).optional(),
});

function verifyWebhook(request: Request): boolean {
  const secret = process.env.MINIBAR_IOT_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-minibar-secret') === secret;
}

export async function POST(request: Request) {
  try {
    if (!verifyWebhook(request)) {
      return jsonOk({ error: 'Unauthorized' }, 401);
    }
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await ingestMinibarSensorEvent(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
