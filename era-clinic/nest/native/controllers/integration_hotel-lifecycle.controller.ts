import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { isSatelliteHotelGuestCheckedIn, isSatelliteHotelGuestCheckedOut, isSatelliteHotelGuestDeparted, isSatelliteHotelGuestMoved, isSatelliteHotelRoomChanged, isSatelliteHotelSanatoriumBookingCreated, isSatelliteHotelStayProductChanged, getSatelliteEventType } from "@era/contracts";
import { handleGuestCheckedIn, handleGuestCheckedOut, handleGuestDeparted, handleGuestMoved, handleRoomChanged, handleSanatoriumBookingCreated, handleStayProductChanged } from "@/lib/lifecycle-consumer";
import { enterRequestTenant } from "@/lib/request-organization";
import { claimHotelLifecycleEvent, releaseHotelLifecycleEventClaim } from "@/domain/sanatorium/stay-checkout-snapshot.service";

@Controller()
export class IntegrationHotelLifecycleController {

  @Post("api/integration/hotel-lifecycle")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const secret = nestHeader(httpReq, "x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  if (!expected || secret !== expected) {
    throw new HttpException({ error: "Unauthorized" }, 401);
  }

  const body = httpReq.body;
  const organizationId =
    body && typeof body === "object" && "organizationId" in body
      ? String((body as { organizationId: unknown }).organizationId ?? "").trim()
      : "";
  if (!organizationId) {
    throw new HttpException({ error: "organizationId required" }, 400);
  }
  enterRequestTenant(organizationId);

  const correlationId =
    body && typeof body === "object" && "correlationId" in body
      ? String((body as { correlationId: unknown }).correlationId)
      : null;
  const eventType = getSatelliteEventType(body) ?? "unknown";

  if (correlationId) {
    const claim = await claimHotelLifecycleEvent({ correlationId, eventType });
    if (claim.status === "duplicate") {
      return { ok: true, duplicate: true };
    }
  }

  try {
    if (isSatelliteHotelSanatoriumBookingCreated(body)) {
      const episode = await handleSanatoriumBookingCreated(body);
      return { ok: true, episodeId: episode.id, planned: true };
    }
    if (isSatelliteHotelGuestCheckedIn(body)) {
      const episode = await handleGuestCheckedIn(body);
      return { ok: true, episodeId: episode.id };
    }
    if (isSatelliteHotelGuestCheckedOut(body)) {
      await handleGuestCheckedOut(body);
      return { ok: true };
    }
    if (isSatelliteHotelGuestDeparted(body)) {
      await handleGuestDeparted(body);
      return { ok: true };
    }
    if (isSatelliteHotelGuestMoved(body)) {
      await handleGuestMoved(body);
      return { ok: true };
    }
    if (isSatelliteHotelRoomChanged(body)) {
      await handleRoomChanged(body);
      return { ok: true };
    }
    if (isSatelliteHotelStayProductChanged(body)) {
      await handleStayProductChanged(body);
      return { ok: true };
    }
    if (correlationId) {
      await releaseHotelLifecycleEventClaim(organizationId, correlationId);
    }
    throw new HttpException({ error: "Unknown event type" }, 400);
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (correlationId) {
      await releaseHotelLifecycleEventClaim(organizationId, correlationId);
    }
    const msg = err instanceof Error ? err.message : "handler failed";
    throw new HttpException({ error: msg }, 500);
  }

        });
  }
}
