import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { openEpisodeFromStay } from '@/lib/services/sanatorium.service';

const bodySchema = z.object({
  reservationId: z.string(),
  hotelStayId: z.string().nullable().optional(),
  guestName: z.string().min(1),
  passportNumber: z.string().min(1),
  phone: z.string().optional(),
  organizationId: z.string().min(1),
  globalPersonId: z.string().nullable().optional(),
});

function assertBridgeSecret(req: Request) {
  const expected = process.env.CLINIC_BRIDGE_SECRET?.trim();
  if (!expected) return;
  const got = req.headers.get('x-clinic-bridge-secret');
  if (got !== expected) {
    throw new Error('Invalid bridge secret');
  }
}

export async function POST(req: Request) {
  try {
    assertBridgeSecret(req);
    const body = bodySchema.parse(await req.json());
    const episode = await openEpisodeFromStay(body);
    return jsonOk(episode);
  } catch (err) {
    if (err instanceof Error && err.message === 'Invalid bridge secret') {
      return jsonError('Unauthorized', 401);
    }
    return handleRouteError(err);
  }
}
