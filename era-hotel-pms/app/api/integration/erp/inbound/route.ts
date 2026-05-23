import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { applyE6FiscalStatusChanged } from '@/lib/services/fiscal-document.service';

const e6Schema = z.object({
  eventType: z.literal('invoice_fiscal_status_changed'),
  invoiceRef: z.string().min(1),
  fiscalStatus: z.string().min(1),
  fiscalExternalId: z.string().optional(),
  rejectionReason: z.string().optional(),
  updatedAt: z.string().optional(),
});

function verifyErpToken(request: Request): boolean {
  const expected = process.env.ERP_INBOUND_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === expected;
  const header = request.headers.get('x-erp-webhook-secret');
  return header === expected;
}

export async function POST(request: Request) {
  try {
    if (!verifyErpToken(request)) {
      return jsonOk({ error: 'Unauthorized' }, 401);
    }
    const body = e6Schema.parse(await request.json());
    const doc = await applyE6FiscalStatusChanged(body);
    return jsonOk(serialize({ applied: true, document: doc }));
  } catch (err) {
    return handleRouteError(err);
  }
}
