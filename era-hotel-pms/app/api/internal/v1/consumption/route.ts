import { z } from 'zod';
import { enterRequestTenant } from '@/lib/request-organization';
import { assertEnvServiceToken } from '@era/satellite-kit';
import { recordInternalConsumption } from '@/lib/services/internal-consumption.service';

const bodySchema = z.object({
  organizationId: z.string().min(1),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sku: z.string().min(1),
  qty: z.number().finite(),
  warehouseCode: z.string().optional(),
  source: z.string().min(1).default('clinic'),
  sourceRef: z.string().min(1),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/** Clinic consumables for the night-audit quantity lines. Bearer SATELLITE_EVENT_SERVICE_TOKEN. */
export async function POST(request: Request) {
  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ['SATELLITE_EVENT_SERVICE_TOKEN'],
      authorization: request.headers.get('authorization'),
      xServiceToken: request.headers.get('x-service-token'),
    });
    if (!gate.ok) return unauthorized(gate.error);
    const body = bodySchema.parse(await request.json());
    enterRequestTenant(body.organizationId);
    const row = await recordInternalConsumption(body);
    return Response.json({ id: row.id, sourceRef: row.sourceRef });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Consumption failed';
    return Response.json({ error: message }, { status: 400 });
  }
}
