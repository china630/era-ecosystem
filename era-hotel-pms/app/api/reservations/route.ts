import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createReservation, listReservations } from '@/lib/services/reservation.service';
import { collectStayOperationalGaps } from '@/lib/services/stay-operational-readiness.service';
import type { ReservationStatus } from '@prisma/client';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  roomTypeId: z.string().uuid(),
  givenRoomTypeId: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  agencyId: z.string().uuid().optional(),
  walkInProfileCode: z.string().max(40).nullable().optional(),
  companyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']),
  partyBillingMode: z.enum(['PRIMARY', 'EQUAL']).optional(),
  adults: z.number().int().min(0).optional(),
  children11_6: z.number().int().min(0).optional(),
  children5_2: z.number().int().min(0).optional(),
  children1_0: z.number().int().min(0).optional(),
  shareEligible: z.boolean().optional(),
  market: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  vipType: z.string().nullable().optional(),
  tripReason: z.string().nullable().optional(),
  booker: z.string().nullable().optional(),
  guestRep: z.string().nullable().optional(),
  paidBy: z.string().nullable().optional(),
  voucherNo: z.string().nullable().optional(),
  resNo: z.string().nullable().optional(),
  shareNo: z.string().nullable().optional(),
  optionDate: z.coerce.date().nullable().optional(),
  optionState: z.string().nullable().optional(),
  salesProject: z.string().nullable().optional(),
  specialStates: z.string().nullable().optional(),
  resGroup: z.string().nullable().optional(),
  colorCode: z.string().nullable().optional(),
  preferredLocation: z.string().nullable().optional(),
  preferredBed: z.string().nullable().optional(),
  contractRef: z.string().nullable().optional(),
  creditLimitAzn: z.number().min(0).nullable().optional(),
  rateType: z.string().nullable().optional(),
  accomType: z.string().nullable().optional(),
  recordType: z.string().nullable().optional(),
  useManualRate: z.boolean().optional(),
  manualDailyRate: z.number().nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  discountActive: z.boolean().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  paxGuests: z
    .array(
      z.object({
        guestId: z.string().uuid().nullable().optional(),
        firstName: z.string().nullable().optional(),
        lastName: z.string().nullable().optional(),
        middleName: z.string().nullable().optional(),
        sex: z.string().nullable().optional(),
        nationality: z.string().nullable().optional(),
        birthDate: z.string().nullable().optional(),
        age: z.number().nullable().optional(),
        idCardNo: z.string().nullable().optional(),
        passportNo: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
        ownsFolio: z.boolean().optional(),
        medicalPackageCode: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as ReservationStatus | null;
    const guestId = url.searchParams.get('guestId') ?? undefined;
    const includeParty = url.searchParams.get('includeParty') === '1';
    const reservations = await listReservations(status ?? undefined, guestId, includeParty);
    return jsonOk(serialize(reservations));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    const reservation = await createReservation(body);
    const operationalGaps = await collectStayOperationalGaps(reservation.id);
    return jsonOk(serialize({ ...reservation, operationalGaps }), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
