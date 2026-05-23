import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listFolios, postCharge, postPayment } from '@/lib/services/folio.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const reservationId = new URL(request.url).searchParams.get('reservationId') ?? undefined;
    return jsonOk(serialize(await listFolios(reservationId)));
  } catch (err) {
    return handleRouteError(err);
  }
}

const chargeSchema = z.object({
  reservationId: z.string().uuid(),
  revenueCodeId: z.string().uuid(),
  amount: z.number().positive(),
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
});

const paymentSchema = z.object({
  folioId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']),
  registerRef: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    const body = await request.json();
    if (body.folioId) {
      assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
      const data = paymentSchema.parse(body);
      return jsonOk(serialize(await postPayment(data)), 201);
    }
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const data = chargeSchema.parse(body);
    return jsonOk(serialize(await postCharge(data)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
