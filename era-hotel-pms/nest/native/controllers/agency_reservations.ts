/** Lifted from era-hotel-pms/nest/generated/agency_reservations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { agencyQuoteAvailability, createAgencyPortalReservation, listAgencyContracts, listAgencyOwnReservations } from '@/lib/services/agency-portal.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class AgencyReservationsController {
  @Get("api/agency/reservations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await requireAgencyPortalSession();
    const [contracts, reservations] = await Promise.all([
      listAgencyContracts(session.agencyId),
      listAgencyOwnReservations(session.agencyId),
    ]);
    return sendJson(httpRes, 
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        email: session.email,
        contracts,
        reservations,
      }),
    );
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/agency/reservations")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await requireAgencyPortalSession();
    const url = requestUrl;
    const action = url.searchParams.get('action') ?? 'create';
    const body = httpReq.body;

    if (action === 'quote') {
      const input = quoteSchema.parse(body);
      const result = await agencyQuoteAvailability({
        agencyId: session.agencyId,
        salesContractId: input.salesContractId,
        roomTypeId: input.roomTypeId,
        checkInDate: new Date(input.checkInDate),
        checkOutDate: new Date(input.checkOutDate),
      });
      return sendJson(httpRes, serialize(result));
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
      audit: { userId: session.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(reservation), 201);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
