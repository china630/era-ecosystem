import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { applyCommissionOffset } from '@/lib/services/agency-commission.service';

const bodySchema = z.object({
  lineIds: z.array(z.string().min(1)).min(1),
  financeOffsetId: z.string().min(1),
});

/** Finance → Hotel: AR↔AP offset marked commission lines PAID (P3). */
export async function POST(request: Request) {
  try {
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = bodySchema.parse(await request.json());
    return jsonOk(await applyCommissionOffset(body));
  } catch (err) {
    return handleRouteError(err);
  }
}
