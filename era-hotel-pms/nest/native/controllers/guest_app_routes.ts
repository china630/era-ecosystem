/** Lifted from era-hotel-pms/nest/guest-app-routes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";
import { runWithSatelliteTenant } from "@era/satellite-kit";
import {
  enterHotelStaff,
  hotelNestSession,
  runWithHotelTenant,
  sendJson,
  sendRouteError,
} from "../../bridge";
import {
  exchangeGuestAppCode,
  GuestAppHttpError,
  issueGuestAppLink,
  patchQuestionnaireFromGuest,
  questionnaireStatus,
  revokeGuestAppLink,
  tripPackForToken,
} from "@/lib/services/guest-app-link.ops";
import {
  answerGuestBookingRequest,
  confirmationLimitedLookup,
  confirmFamilyGrantStaff,
  createFamilyGrant,
  createGuestBookingRequest,
  createGuestStayOrder,
  guestBoardSummary,
  guestCareEpisodes,
  guestCareResults,
  guestCareTimetable,
  guestFolioSummary,
  guestBookTour,
  guestCreateLaundryTicket,
  guestLaundryBoard,
  guestOpenTransfers,
  guestTourBoard,
  listFamilyGrantsForReservation,
  listGuestAppMessages,
  listGuestBookingRequests,
  listGuestStayOrders,
  listStaffBookingRequests,
  listStaffStayOrders,
  markGuestAppMessageRead,
  patchStaffStayOrderStatus,
  revokeFamilyGrant,
  staffSendGuestAppMessage,
  startPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/services/guest-app-cycle.ops";

function bearerToken(req: ExpressRequest): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim() || null;
  }
  return null;
}

function parseQrCode(raw: string): { organizationId: string; code: string } | null {
  const parts = raw.split("|");
  if (parts.length === 3 && parts[0] === "ERA-GUEST" && parts[1] && parts[2]) {
    return { organizationId: parts[1], code: parts[2] };
  }
  return null;
}

async function guestCatch(
  httpRes: ExpressResponse,
  err: unknown,
): Promise<void> {
  if (err instanceof GuestAppHttpError) {
    sendJson(httpRes, { code: err.code }, err.status);
    return;
  }
  await sendRouteError(httpRes, err);
}


@Controller()
export class GuestAppRoutesController {
  @Post("api/guest-app/reservations/:reservationId/pax/:paxId/link")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await runWithHotelTenant(session, async () => {
          const out = await issueGuestAppLink({
            organizationId: session.organizationId,
            reservationGuestId: String(httpReq.params.paxId),
            actorUserId: session.sub,
          });
          sendJson(httpRes, out);
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Post("api/guest-app/reservations/:reservationId/pax/:paxId/unlink")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await runWithHotelTenant(session, async () => {
          const out = await revokeGuestAppLink({
            organizationId: session.organizationId,
            reservationGuestId: String(httpReq.params.paxId),
            actorUserId: session.sub,
          });
          sendJson(httpRes, out);
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Get("api/guest-app/reservations/:reservationId/questionnaire")
  @HttpCode(200)
  async get_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await runWithHotelTenant(session, async () => {
          const out = await questionnaireStatus({
            organizationId: session.organizationId,
            reservationId: String(httpReq.params.reservationId),
          });
          sendJson(httpRes, { items: out });
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Post("api/guest-app/exchange")
  @HttpCode(200)
  async post_3(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const body = (httpReq.body ?? {}) as { organizationId?: string; code?: string; qrPayload?: string };
      let organizationId = body.organizationId?.trim() ?? "";
      let code = body.code?.trim() ?? "";
      if (body.qrPayload) {
        const parsed = parseQrCode(body.qrPayload.trim());
        if (!parsed) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
        organizationId = parsed.organizationId;
        code = parsed.code;
      }
      if (!organizationId || !code) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      const out = await runWithSatelliteTenant({ organizationId }, () =>
        exchangeGuestAppCode({ organizationId, code }),
      );
      sendJson(httpRes, out);
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/trip")
  @HttpCode(200)
  async get_4(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await tripPackForToken(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Patch("api/guest-app/questionnaire")
  @HttpCode(200)
  async patch_5(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(
        httpRes,
        await patchQuestionnaireFromGuest({
          token,
          body: (httpReq.body ?? {}) as Record<string, string>,
        }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/booking-requests")
  @HttpCode(200)
  async post_6(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const body = (httpReq.body ?? {}) as Record<string, unknown>;
      const organizationId = String(body.organizationId ?? "").trim();
      if (!organizationId) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      const out = await createGuestBookingRequest({
        organizationId,
        token: bearerToken(httpReq),
        checkInYmd: String(body.checkIn ?? ""),
        checkOutYmd: String(body.checkOut ?? ""),
        adults: Number(body.adults ?? 1),
        children: Number(body.children ?? 0),
        packageNote: body.packageNote != null ? String(body.packageNote) : undefined,
        contactPhone: body.contactPhone != null ? String(body.contactPhone) : undefined,
        contactName: body.contactName != null ? String(body.contactName) : undefined,
      });
      sendJson(httpRes, out, 201);
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/booking-requests")
  @HttpCode(200)
  async get_7(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const organizationId = String(httpReq.query.organizationId ?? "").trim();
      if (!organizationId) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      sendJson(httpRes, {
        items: await listGuestBookingRequests({
          organizationId,
          token: bearerToken(httpReq),
        }),
      });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/staff/booking-requests")
  @HttpCode(200)
  async get_8(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      await runWithHotelTenant(session, async () => {
        sendJson(httpRes, { items: await listStaffBookingRequests(session.organizationId) });
      });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/staff/booking-requests/:id/answer")
  @HttpCode(200)
  async post_9(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      const body = (httpReq.body ?? {}) as {
        reservationId?: string | null;
        cancel?: boolean;
        staffNote?: string;
      };
      await runWithHotelTenant(session, async () => {
        sendJson(
          httpRes,
          await answerGuestBookingRequest({
            organizationId: session.organizationId,
            requestId: String(httpReq.params.id),
            reservationId: body.reservationId ?? null,
            cancel: Boolean(body.cancel),
            actorUserId: session.sub,
            staffNote: body.staffNote,
          }),
        );
      });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/orders")
  @HttpCode(200)
  async post_10(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      const body = (httpReq.body ?? {}) as Record<string, unknown>;
      sendJson(
        httpRes,
        await createGuestStayOrder({
          token,
          kind: String(body.kind ?? ""),
          note: body.note != null ? String(body.note) : undefined,
          scheduledAt: body.scheduledAt != null ? String(body.scheduledAt) : undefined,
          queuedOffline: Boolean(body.queuedOffline),
        }),
        201,
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/orders")
  @HttpCode(200)
  async get_11(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, { items: await listGuestStayOrders(token) });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/folio")
  @HttpCode(200)
  async get_12(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestFolioSummary(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/board")
  @HttpCode(200)
  async get_13(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestBoardSummary(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/transfers")
  @HttpCode(200)
  async get_14(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestOpenTransfers(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/laundry")
  @HttpCode(200)
  async get_15(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestLaundryBoard(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/laundry")
  @HttpCode(200)
  async post_16(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      const body = (httpReq.body ?? {}) as {
        itemId?: string;
        washQty?: number;
        ironQty?: number;
        express?: boolean;
      };
      sendJson(
        httpRes,
        await guestCreateLaundryTicket({
          token,
          itemId: String(body.itemId ?? ""),
          washQty: Number(body.washQty ?? 0),
          ironQty: Number(body.ironQty ?? 0),
          express: Boolean(body.express),
        }),
        201,
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/tours")
  @HttpCode(200)
  async get_17(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestTourBoard(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/tours")
  @HttpCode(200)
  async post_18(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      const body = (httpReq.body ?? {}) as { departureId?: string };
      sendJson(
        httpRes,
        await guestBookTour({ token, departureId: String(body.departureId ?? "") }),
        201,
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/messages")
  @HttpCode(200)
  async get_19(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, { items: await listGuestAppMessages(token) });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Patch("api/guest-app/messages/:id/read")
  @HttpCode(200)
  async patch_20(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(
        httpRes,
        await markGuestAppMessageRead({
          token,
          messageId: String(httpReq.params.id),
        }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/reservations/:reservationId/pax/:paxId/messages")
  @HttpCode(200)
  async post_21(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        const body = (httpReq.body ?? {}) as { kind?: string; body?: string };
        const kind = String(body.kind ?? "RECEPTION").toUpperCase();
        if (kind !== "RECEPTION" && kind !== "CLINIC" && kind !== "MARKETING") {
          return sendJson(httpRes, { code: "BAD_KIND" }, 400);
        }
        await runWithHotelTenant(session, async () => {
          sendJson(
            httpRes,
            await staffSendGuestAppMessage({
              organizationId: session.organizationId,
              reservationGuestId: String(httpReq.params.paxId),
              kind,
              body: String(body.body ?? ""),
              actorUserId: session.sub,
            }),
            201,
          );
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Get("api/guest-app/reservations/:reservationId/orders")
  @HttpCode(200)
  async get_22(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await runWithHotelTenant(session, async () => {
          sendJson(httpRes, {
            items: await listStaffStayOrders({
              organizationId: session.organizationId,
              reservationId: String(httpReq.params.reservationId),
            }),
          });
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Patch("api/guest-app/staff/orders/:id")
  @HttpCode(200)
  async patch_23(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      const body = (httpReq.body ?? {}) as { status?: string };
      const status = body.status;
      if (status !== "CONFIRMED" && status !== "COMPLETED" && status !== "CANCELLED") {
        return sendJson(httpRes, { code: "BAD_STATUS" }, 400);
      }
      await runWithHotelTenant(session, async () => {
        sendJson(
          httpRes,
          await patchStaffStayOrderStatus({
            organizationId: session.organizationId,
            orderId: String(httpReq.params.id),
            status,
            actorUserId: session.sub,
          }),
        );
      });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/care/timetable")
  @HttpCode(200)
  async get_24(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      const subjectGuestId =
        typeof httpReq.query.subjectGuestId === "string"
          ? httpReq.query.subjectGuestId
          : undefined;
      sendJson(httpRes, await guestCareTimetable({ token, subjectGuestId }));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/care/results")
  @HttpCode(200)
  async get_25(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestCareResults(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/care/episodes")
  @HttpCode(200)
  async get_26(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(httpRes, await guestCareEpisodes(token));
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/family-grants")
  @HttpCode(200)
  async post_27(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      const body = (httpReq.body ?? {}) as { granteeGuestId?: string };
      sendJson(
        httpRes,
        await createFamilyGrant({
          token,
          granteeGuestId: String(body.granteeGuestId ?? ""),
        }),
        201,
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/family-grants/:id/revoke")
  @HttpCode(200)
  async post_28(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const token = bearerToken(httpReq);
      if (!token) return sendJson(httpRes, { code: "REVOKED" }, 401);
      sendJson(
        httpRes,
        await revokeFamilyGrant({ token, grantId: String(httpReq.params.id) }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Get("api/guest-app/reservations/:reservationId/family-grants")
  @HttpCode(200)
  async get_29(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
      if (!(await enterHotelStaff(httpReq, httpRes))) return;
      try {
        const session = await hotelNestSession(httpReq);
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await runWithHotelTenant(session, async () => {
          sendJson(httpRes, {
            items: await listFamilyGrantsForReservation({
              organizationId: session.organizationId,
              reservationId: String(httpReq.params.reservationId),
            }),
          });
        });
      } catch (err) {
        await guestCatch(httpRes, err);
      }
      }

  @Post("api/guest-app/staff/family-grants/:id/confirm")
  @HttpCode(200)
  async post_30(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      await runWithHotelTenant(session, async () => {
        sendJson(
          httpRes,
          await confirmFamilyGrantStaff({
            organizationId: session.organizationId,
            grantId: String(httpReq.params.id),
            actorUserId: session.sub,
          }),
        );
      });
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/auth/phone/start")
  @HttpCode(200)
  async post_31(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const body = (httpReq.body ?? {}) as {
        organizationId?: string;
        channel?: string;
        destination?: string;
      };
      const organizationId = String(body.organizationId ?? "").trim();
      const channel = String(body.channel ?? "SMS").toUpperCase();
      if (channel !== "SMS" && channel !== "WHATSAPP" && channel !== "EMAIL") {
        return sendJson(httpRes, { code: "BAD_CHANNEL" }, 400);
      }
      if (!organizationId) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      sendJson(
        httpRes,
        await startPhoneOtp({
          organizationId,
          channel,
          destination: String(body.destination ?? ""),
        }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/auth/phone/verify")
  @HttpCode(200)
  async post_32(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const body = (httpReq.body ?? {}) as {
        organizationId?: string;
        channel?: string;
        destination?: string;
        code?: string;
      };
      const organizationId = String(body.organizationId ?? "").trim();
      const channel = String(body.channel ?? "SMS").toUpperCase();
      if (channel !== "SMS" && channel !== "WHATSAPP" && channel !== "EMAIL") {
        return sendJson(httpRes, { code: "BAD_CHANNEL" }, 400);
      }
      if (!organizationId) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      sendJson(
        httpRes,
        await verifyPhoneOtp({
          organizationId,
          channel,
          destination: String(body.destination ?? ""),
          code: String(body.code ?? ""),
        }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }

  @Post("api/guest-app/auth/confirmation")
  @HttpCode(200)
  async post_33(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const body = (httpReq.body ?? {}) as {
        organizationId?: string;
        confirmation?: string;
        surname?: string;
        arrivalYmd?: string;
      };
      const organizationId = String(body.organizationId ?? "").trim();
      if (!organizationId) return sendJson(httpRes, { code: "NOT_FOUND" }, 404);
      sendJson(
        httpRes,
        await confirmationLimitedLookup({
          organizationId,
          confirmation: String(body.confirmation ?? ""),
          surname: String(body.surname ?? ""),
          arrivalYmd: String(body.arrivalYmd ?? ""),
        }),
      );
    } catch (err) {
      await guestCatch(httpRes, err);
    }
    }
}
