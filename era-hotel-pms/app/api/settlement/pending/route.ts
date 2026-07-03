import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createPendingCharge } from '@/lib/services/settlement-hub.service';

const schema = z.object({
  sourceSystem: z.enum(['FNB_POS', 'CLINIC', 'RETAIL']),
  sourceOrgId: z.string().min(1),
  sourceRef: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('AZN'),
  description: z.string().min(1),
  payerLabel: z.string().optional(),
  globalPersonId: z.string().optional(),
  reservationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(await request.json());
    const headerKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey =
      headerKey || `${body.sourceSystem.toLowerCase()}-${body.sourceRef}`;

    const result = await createPendingCharge({
      ...body,
      idempotencyKey,
    });

    return jsonOk(
      serialize({
        ...result.charge,
        idempotent: result.idempotent,
      }),
      result.idempotent ? 200 : 201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_PAYMENT);
    const url = new URL(request.url);
    const status = (url.searchParams.get('status') ?? 'PENDING') as
      | 'PENDING'
      | 'PAID'
      | 'VOID';
    const { listPendingCharges } = await import('@/lib/services/settlement-hub.service');
    const rows = await listPendingCharges(status);
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}
