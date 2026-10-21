import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listFolios, postCharge, postPayment } from '@/lib/services/folio.service';
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
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
  amount: z.number(), // allow negative for DISCOUNT posts via API if needed
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
});

const paymentSchema = z.object({
  folioId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  revenueCodeId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentMethod: z.enum(DESK_PAYMENT_METHODS),
  registerRef: z.string().optional(),
  bankReference: z.string().max(120).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
}).refine((row) => Boolean(row.folioId || row.reservationId), {
  message: 'folioId or reservationId is required',
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const body = await request.json();
    if (body.folioId || (body.reservationId && body.paymentMethod)) {
      assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
      const data = paymentSchema.parse(body);
      let folioId = data.folioId;
      if (!folioId && data.reservationId) {
        const { ensureOpenFolio } = await import('@/lib/services/booking-folio.service');
        const folio = await ensureOpenFolio(data.reservationId, data.folioType ?? 'GUEST');
        folioId = folio.id;
      }
      const payment = await postPayment({
        folioId: folioId!,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        registerRef: data.registerRef,
        bankReference: data.bankReference,
        bankTerminalId: data.bankTerminalId,
        revenueCodeId: data.revenueCodeId,
        createdByUserId: session?.sub,
        auditRequest: request,
      });
      return jsonOk(serialize(payment), 201);
    }
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const data = chargeSchema.parse(body);
    return jsonOk(
      serialize(
        await postCharge({
          ...data,
          folioType: data.folioType,
          audit: { userId: session?.sub, request },
        }),
      ),
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
