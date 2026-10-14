import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listFolios, postCharge, postPayment } from '@/lib/services/folio.service';
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

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
});

const paymentSchema = z.object({
  folioId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(DESK_PAYMENT_METHODS),
  registerRef: z.string().optional(),
  bankReference: z.string().max(120).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const body = await request.json();
    if (body.folioId) {
      assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
      const data = paymentSchema.parse(body);
      const payment = await postPayment({ ...data, createdByUserId: session?.sub });
      const folio = await prisma.folio.findUnique({
        where: { id: data.folioId },
        select: { reservationId: true },
      });
      if (folio) {
        await recordHotelAudit(
          { userId: session?.sub, request },
          'Reservation',
          folio.reservationId,
          'PAYMENT',
          {
            paymentId: payment.id,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            bankTerminalId: data.bankTerminalId ?? null,
            reservationId: folio.reservationId,
          },
        );
      }
      return jsonOk(serialize(payment), 201);
    }
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const data = chargeSchema.parse(body);
    return jsonOk(serialize(await postCharge(data)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
