import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getReservationFull, patchReservationFull } from '@/lib/services/reservation-full.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
const patchSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  ratePlanId: z.string().uuid().optional(),
  mealPlanId: z.string().uuid().nullable().optional(),
  agencyId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  guestId: z.string().uuid().optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']).optional(),
  voucherNo: z.string().nullable().optional(),
  roomCount: z.number().int().min(1).optional(),
  adults: z.number().int().min(0).optional(),
  children11_6: z.number().int().min(0).optional(),
  children5_2: z.number().int().min(0).optional(),
  children1_0: z.number().int().min(0).optional(),
  market: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  rateType: z.string().nullable().optional(),
  booker: z.string().nullable().optional(),
  guestRep: z.string().nullable().optional(),
  paidBy: z.string().nullable().optional(),
  vipType: z.string().nullable().optional(),
  accomType: z.string().nullable().optional(),
  recordType: z.string().nullable().optional(),
  specialStates: z.string().nullable().optional(),
  tripReason: z.string().nullable().optional(),
  resGroup: z.string().nullable().optional(),
  colorCode: z.string().nullable().optional(),
  resNo: z.string().nullable().optional(),
  shareNo: z.string().nullable().optional(),
  optionDate: z.coerce.date().nullable().optional(),
  optionState: z.string().nullable().optional(),
  salesProject: z.string().nullable().optional(),
  useManualRate: z.boolean().optional(),
  manualDailyRate: z.number().nullable().optional(),
  discountActive: z.boolean().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  paxGuests: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().nullable().optional(),
        gender: z.string().nullable().optional(),
        firstName: z.string().nullable().optional(),
        lastName: z.string().nullable().optional(),
        nationality: z.string().nullable().optional(),
        birthDate: z.string().nullable().optional(),
        age: z.number().nullable().optional(),
        idCardNo: z.string().nullable().optional(),
        passportNo: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getReservationFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    return jsonOk(serialize(await patchReservationFull(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
