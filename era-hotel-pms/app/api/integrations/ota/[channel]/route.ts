import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';

const bodySchema = z.object({
  event: z.string().min(1),
  externalReservationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

/** OTA webhook ingest stub (pre-GA G2) — live connectors in BACKLOG-PRODUCTION. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  try {
    const { channel } = await params;
    const secret = process.env.ERA_OTA_WEBHOOK_SECRET?.trim();
    if (secret) {
      const header = request.headers.get('x-era-ota-secret')?.trim();
      if (header !== secret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = bodySchema.parse(await request.json());
    return jsonOk({
      accepted: true,
      channel,
      event: body.event,
      externalReservationId: body.externalReservationId ?? null,
      mode: process.env.ERA_OTA_MODE ?? 'stub',
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
