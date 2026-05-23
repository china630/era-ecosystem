import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { addLabResult, createOrder, postProcedureToFolio } from '@/lib/services/medical.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const orderSchema = z.object({
  reservationId: z.string().uuid(),
  orderType: z.string().min(1),
});

const labSchema = z.object({
  orderId: z.string().uuid(),
  testName: z.string(),
  resultValue: z.string(),
  flag: z.enum(['NORMAL', 'HIGH', 'LOW']).optional(),
});

const procSchema = z.object({
  reservationId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  amount: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = await request.json();
    if (body.orderId && body.testName) {
      return jsonOk(serialize(await addLabResult(body.orderId, labSchema.parse(body))), 201);
    }
    if (body.code && body.name && body.amount) {
      return jsonOk(serialize(await postProcedureToFolio(body.reservationId, procSchema.parse(body))), 201);
    }
    const data = orderSchema.parse(body);
    return jsonOk(serialize(await createOrder(data.reservationId, data.orderType)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
