import type { Express } from 'express';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import {
  applyTransferDecisions,
  proposeTransferShiftsForStay,
  listOpenTransfersForStay,
} from '@/lib/services/stay-mobility-sync.service';
import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import {
  enterHotelStaff,
  hotelNestSession,
  runWithHotelTenant,
  runWithNestHttp,
  sendJson,
  sendRouteError,
  sendWebResponse,
} from './bridge';

const decisionSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(['SHIFT', 'KEEP', 'CANCEL', 'LEAVE']),
  pickupAt: z.string().datetime().optional(),
});

const applySchema = z.object({
  reservationId: z.string().uuid(),
  decisions: z.array(decisionSchema).min(1),
});

const previewSchema = z.object({
  reservationId: z.string().uuid(),
  checkInDate: z.string().datetime().optional(),
  checkOutDate: z.string().datetime().optional(),
});

export function registerStayMobilityRoutes(http: Express) {
  http.get('/api/transfers/stay-open', async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () =>
        runWithNestHttp(httpReq, async () => {
          // Card chips: FO with reservations.read must see open mobility without transfers.write.
          assertAnyPermission(session, [
            PERMISSIONS.RESERVATIONS_READ,
            PERMISSIONS.TRANSFERS_WRITE,
          ]);
          await requireHotelModule('hotel_transfers', session.organizationId);
          const reservationId = String(
            (httpReq.query as { reservationId?: string }).reservationId ?? '',
          );
          if (!reservationId) {
            throw Object.assign(new Error('reservationId required'), { status: 400 });
          }
          const [transfers, tours] = await Promise.all([
            listOpenTransfersForStay(reservationId),
            prisma.tourBooking.findMany({
              where: {
                reservationId,
                status: { in: ['RESERVED', 'CHARGED', 'PAID', 'ON_CITY_LEDGER'] },
              },
              include: {
                departure: { select: { id: true, date: true, agenda: true, status: true } },
              },
              orderBy: { createdAt: 'asc' },
            }),
          ]);
          return sendJson(
            httpRes,
            serialize({
              transfers,
              tours: tours.map((b) => ({
                id: b.id,
                status: b.status,
                departureId: b.departure.id,
                date: hotelDateKey(b.departure.date),
                agenda: b.departure.agenda,
                departureStatus: b.departure.status,
              })),
            }),
          );
        }),
      );
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });

  http.post('/api/transfers/stay-preview', async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () =>
        runWithNestHttp(httpReq, async () => {
          assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
          await requireHotelModule('hotel_transfers', session.organizationId);
          const body = previewSchema.parse(httpReq.body ?? {});
          const stay = await prisma.reservation.findUnique({
            where: { id: body.reservationId },
            select: { checkInDate: true, checkOutDate: true },
          });
          if (!stay) throw Object.assign(new Error('Reservation not found'), { status: 404 });
          const checkInDate = body.checkInDate ? new Date(body.checkInDate) : stay.checkInDate;
          const checkOutDate = body.checkOutDate ? new Date(body.checkOutDate) : stay.checkOutDate;
          const transfers = await proposeTransferShiftsForStay(body.reservationId, {
            checkInDate,
            checkOutDate,
          });
          return sendJson(
            httpRes,
            serialize({
              transfers: transfers.map((t) => ({
                ...t,
                pickupAt: t.pickupAt.toISOString(),
                proposedPickupAt: t.proposedPickupAt.toISOString(),
              })),
            }),
          );
        }),
      );
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });

  http.post('/api/transfers/stay-apply', async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () =>
        runWithNestHttp(httpReq, async () => {
          assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
          await requireHotelModule('hotel_transfers', session.organizationId);
          const body = applySchema.parse(httpReq.body ?? {});
          const results = await applyTransferDecisions(body.reservationId, body.decisions);
          return sendJson(httpRes, serialize({ results }));
        }),
      );
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
