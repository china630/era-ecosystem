import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { applyCommissionPaid } from '@/lib/services/agency-commission.service';
import { prisma } from '@/lib/prisma';
import { enterRequestTenant } from '@/lib/request-organization';

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  batchId: z.string().min(1).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
  financePayableId: z.string().min(1),
  paymentId: z.string().min(1),
  currency: z.literal('AZN').optional(),
});

/**
 * Finance → Hotel: mark commission batch/lines PAID after AP bank payment.
 * Idempotent by financePayableId on batch when already PAID.
 */
export async function POST(request: Request) {
  try {
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    enterRequestTenant(body.organizationId);

    if (body.batchId) {
      const batch = await prisma.agencyCommissionBatch.findUnique({
        where: { id: body.batchId },
      });
      if (!batch) {
        return Response.json({ error: 'Batch not found' }, { status: 404 });
      }
      if (batch.status === 'PAID' && batch.financePayableId === body.financePayableId) {
        return jsonOk({ alreadyApplied: true, batchId: batch.id, paymentId: body.paymentId });
      }
    }

    const result = await applyCommissionPaid({
      batchId: body.batchId,
      lineIds: body.lineIds,
      financePayableId: body.financePayableId,
      paymentRef: body.paymentId,
    });
    return jsonOk({ ...result, alreadyApplied: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
