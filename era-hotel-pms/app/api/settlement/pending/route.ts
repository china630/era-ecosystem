import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createPendingCharge } from '@/lib/services/settlement-hub.service';
import { enterSatelliteTenant, satelliteRuntimeConfig } from '@era/satellite-kit';

const schema = z.object({
  sourceSystem: z.enum(['FNB_POS', 'CLINIC', 'RETAIL']),
  sourceOrgId: z.string().min(1),
  hotelOrganizationId: z.string().uuid().optional(),
  sourceRef: z.string().min(1),
  amount: z.number().finite(),
  sku: z.string().min(1).optional(),
  qty: z.number().int().refine((qty) => qty !== 0).optional(),
  revenueCode: z.enum(['FOOD', 'MEDICAL', 'RETAIL']).optional(),
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
    const orgFromHeader = request.headers.get('x-era-organization-id')?.trim();
    const hotelOrganizationId = body.hotelOrganizationId?.trim() || orgFromHeader || '';
    if (satelliteRuntimeConfig().deploymentTopology === 'SHARED' && !hotelOrganizationId) {
      return Response.json(
        { error: 'hotelOrganizationId required on SHARED pool' },
        { status: 400 },
      );
    }
    if (hotelOrganizationId) {
      enterSatelliteTenant({ organizationId: hotelOrganizationId });
    }
    const headerKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey =
      headerKey || `${body.sourceSystem.toLowerCase()}-${body.sourceRef}`;
    const { hotelOrganizationId: _hotelOrganizationId, ...charge } = body;

    const result = await createPendingCharge({
      ...charge,
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
