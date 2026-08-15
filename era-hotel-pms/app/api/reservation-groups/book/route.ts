import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createGroupBookingWithStays } from '@/lib/services/booking-stays.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  adults: z.number().int().min(1).max(20),
  children11_6: z.number().int().min(0).optional(),
  children5_2: z.number().int().min(0).optional(),
  children1_0: z.number().int().min(0).optional(),
  ratePlanId: z.string().uuid().optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
});

const schema = z.object({
  code: z.string().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(120),
  agencyId: z.string().uuid().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']).optional(),
  sourceId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  booker: z.string().optional(),
  guestRep: z.string().optional(),
  paidBy: z.string().optional(),
  contractRef: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

/** POST /api/reservation-groups/book — group envelope + N room stays. */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    if (body.checkOutDate <= body.checkInDate) {
      throw new Error('Check-out must be after check-in');
    }
    const result = await createGroupBookingWithStays(body);
    return jsonOk(serialize(result), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
