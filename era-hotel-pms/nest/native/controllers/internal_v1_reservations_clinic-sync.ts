/** Lifted from era-hotel-pms/nest/generated/internal_v1_reservations_clinic-sync.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { listClinicSyncSnapshot } from "@/lib/services/clinic-sync-snapshot.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  openReservationIds: z.array(z.string().min(1)).max(200).default([]),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** In-house medical guests plus which of the clinic's open stays are already checked out. */


@Controller()
export class InternalV1ReservationsClinicSyncController {
  @Post("api/internal/v1/reservations/clinic-sync")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  if (!assertServiceToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const body = bodySchema.parse(httpReq.body);
  enterRequestTenant(body.organizationId);
  const snapshot = await listClinicSyncSnapshot(body);
  return sendJson(httpRes, snapshot);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
