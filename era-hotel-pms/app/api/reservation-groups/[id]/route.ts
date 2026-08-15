import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  addStayToBooking,
  listBookingStays,
  updateBookingEnvelope,
} from '@/lib/services/booking-stays.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  agencyId: z.string().uuid().nullable().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  allotmentBlockId: z.string().uuid().nullable().optional(),
  checkInDate: z.coerce.date().nullable().optional(),
  checkOutDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const addStaySchema = z.object({
  roomTypeId: z.string().uuid(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT', 'LOYALTY_POINTS']),
  agencyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  adults: z.number().int().positive().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await ctx.params;
    return jsonOk(serialize(await listBookingStays(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    return jsonOk(serialize(await updateBookingEnvelope(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await ctx.params;
    const body = addStaySchema.parse(await request.json());
    const stay = await addStayToBooking({ groupId: id, ...body });
    return jsonOk(serialize(stay), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
