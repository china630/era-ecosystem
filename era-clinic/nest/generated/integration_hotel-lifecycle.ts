import { NextResponse } from "next/server";
import { isSatelliteHotelGuestCheckedIn, isSatelliteHotelGuestCheckedOut, isSatelliteHotelGuestDeparted, isSatelliteHotelGuestMoved, isSatelliteHotelRoomChanged, isSatelliteHotelSanatoriumBookingCreated, isSatelliteHotelStayProductChanged, getSatelliteEventType } from "@era/contracts";
import { handleGuestCheckedIn, handleGuestCheckedOut, handleGuestDeparted, handleGuestMoved, handleRoomChanged, handleSanatoriumBookingCreated, handleStayProductChanged } from "@/lib/lifecycle-consumer";
import { enterRequestTenant } from "@/lib/request-organization";
import { claimHotelLifecycleEvent, releaseHotelLifecycleEventClaim } from "@/domain/sanatorium/stay-checkout-snapshot.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/hotel-lifecycle", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  const secret = request.headers.get("x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  if (!expected || secret !== expected) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  const body = httpReq.body;
  const organizationId =
    body && typeof body === "object" && "organizationId" in body
      ? String((body as { organizationId: unknown }).organizationId ?? "").trim()
      : "";
  if (!organizationId) {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
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
      return sendJson(httpRes, { ok: true, duplicate: true });
    }
  }

  try {
    if (isSatelliteHotelSanatoriumBookingCreated(body)) {
      const episode = await handleSanatoriumBookingCreated(body);
      return sendJson(httpRes, { ok: true, episodeId: episode.id, planned: true });
    }
    if (isSatelliteHotelGuestCheckedIn(body)) {
      const episode = await handleGuestCheckedIn(body);
      return sendJson(httpRes, { ok: true, episodeId: episode.id });
    }
    if (isSatelliteHotelGuestCheckedOut(body)) {
      await handleGuestCheckedOut(body);
      return sendJson(httpRes, { ok: true });
    }
    if (isSatelliteHotelGuestDeparted(body)) {
      await handleGuestDeparted(body);
      return sendJson(httpRes, { ok: true });
    }
    if (isSatelliteHotelGuestMoved(body)) {
      await handleGuestMoved(body);
      return sendJson(httpRes, { ok: true });
    }
    if (isSatelliteHotelRoomChanged(body)) {
      await handleRoomChanged(body);
      return sendJson(httpRes, { ok: true });
    }
    if (isSatelliteHotelStayProductChanged(body)) {
      await handleStayProductChanged(body);
      return sendJson(httpRes, { ok: true });
    }
    if (correlationId) {
      await releaseHotelLifecycleEventClaim(organizationId, correlationId);
    }
    return sendJson(httpRes, { error: "Unknown event type" }, 400);
  } catch (err) {
    if (correlationId) {
      await releaseHotelLifecycleEventClaim(organizationId, correlationId);
    }
    const msg = err instanceof Error ? err.message : "handler failed";
    return sendJson(httpRes, { error: msg }, 500);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
