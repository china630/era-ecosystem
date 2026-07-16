import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { authenticateBridgeRequest } from '@/lib/integration/elektraweb-bridge/auth';
import {
  bridgeEnvelopeSchema,
  ingestElektrawebBridgeEnvelope,
} from '@/lib/integration/elektraweb-bridge/ingest';

const batchSchema = z.object({
  items: z.array(bridgeEnvelopeSchema).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateBridgeRequest(request);
    const json = await request.json();

    if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
      const { items } = batchSchema.parse(json);
      // Guests → reservations → folio within each item's entity, but across batch sort by entity
      const order = { guest: 0, reservation: 1, folio: 2, unknown: 3 } as const;
      const sorted = [...items].sort((a, b) => {
        const ea = a.entityHint ?? 'unknown';
        const eb = b.entityHint ?? 'unknown';
        return order[ea] - order[eb];
      });
      const results = [];
      for (const item of sorted) {
        results.push(await ingestElektrawebBridgeEnvelope(auth, item));
      }
      return jsonOk({
        organizationId: auth.organizationId,
        elektrawebHotelId: auth.elektrawebHotelId,
        results,
      });
    }

    const envelope = bridgeEnvelopeSchema.parse(json);
    const summary = await ingestElektrawebBridgeEnvelope(auth, envelope);
    return jsonOk(summary);
  } catch (err) {
    if (err instanceof Error && err.message.includes('HOTELID mismatch')) {
      return jsonError(err.message, 409);
    }
    return handleRouteError(err);
  }
}
