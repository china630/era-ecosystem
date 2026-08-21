import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getAgencySession } from '@/lib/auth/agency-session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import {
  agencyQuoteAvailability,
  createAgencyPortalReservation,
  listAgencyContracts,
  listAgencyOwnReservations,
} from '@/lib/services/agency-portal.service';

export async function GET() {
  try {
    await requireHotelModule('hotel_agency_portal');
    const session = await getAgencySession();
    const [contracts, reservations] = await Promise.all([
      listAgencyContracts(session.agencyId),
      listAgencyOwnReservations(session.agencyId),
    ]);
    return jsonOk(
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        email: session.email,
        contracts,
        reservations,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const quoteSchema = z.object({
  salesContractId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  checkInDate: z.string().min(8),
  checkOutDate: z.string().min(8),
});

const createSchema = quoteSchema.extend({
  guestFullName: z.string().min(2),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestNationality: z.string().optional(),
  adults: z.number().int().min(1).optional(),
  externalRef: z.string().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  try {
    await requireHotelModule('hotel_agency_portal');
    const session = await getAgencySession();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'create';
    const body = await request.json();

    if (action === 'quote') {
      const input = quoteSchema.parse(body);
      const result = await agencyQuoteAvailability({
        agencyId: session.agencyId,
        salesContractId: input.salesContractId,
        roomTypeId: input.roomTypeId,
        checkInDate: new Date(input.checkInDate),
        checkOutDate: new Date(input.checkOutDate),
      });
      return jsonOk(serialize(result));
    }

    const input = createSchema.parse(body);
    // Force agencyId from session — never trust client agencyId
    const reservation = await createAgencyPortalReservation({
      agencyId: session.agencyId,
      salesContractId: input.salesContractId,
      roomTypeId: input.roomTypeId,
      checkInDate: new Date(input.checkInDate),
      checkOutDate: new Date(input.checkOutDate),
      guest: {
        fullName: input.guestFullName,
        phone: input.guestPhone,
        email: input.guestEmail,
        nationality: input.guestNationality,
      },
      adults: input.adults,
      bookerEmail: session.email,
      externalRef: input.externalRef,
    });
    return jsonOk(serialize(reservation), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
