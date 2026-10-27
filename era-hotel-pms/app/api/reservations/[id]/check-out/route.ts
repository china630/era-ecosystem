import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { checkoutReservation } from '@/lib/services/checkout.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z
  .object({
    transferToCityLedger: z.boolean().optional(),
    moveGuestDebtToPayer: z.boolean().optional(),
    transferToGuestDebt: z.boolean().optional(),
    guestDebtNote: z.string().max(500).optional(),
    discountAmount: z.number().positive().optional(),
    discountDescription: z.string().max(200).optional(),
    unusedNightsRefundMethod: z.enum(['CASH', 'CARD']).optional(),
    unusedNightsBankTerminalId: z.string().min(1).max(64).optional(),
    unusedNightsReason: z.string().max(500).optional(),
    procedureCreditRefundMethod: z.enum(['CASH', 'CARD']).optional(),
    procedureCreditBankTerminalId: z.string().min(1).max(64).optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = await params;
    const rawText = await request.text();
    const parsed = rawText.trim() ? bodySchema.parse(JSON.parse(rawText)) : undefined;
    const result = await checkoutReservation(id, {
      ...(parsed ?? {}),
      createdByUserId: session?.sub,
      auditRequest: request,
    });
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
