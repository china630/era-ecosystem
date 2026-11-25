/** Lifted from era-hotel-pms/nest/generated/internal_v1_placement_preflight.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { computePrismaMigrationHash } from "@era/satellite-kit/placement";
import { prisma } from "@/lib/prisma";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function assertServiceToken(headers: { get(name: string): string | null }): boolean {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const auth = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return auth === token;
}

async function preflight(httpReq: Request, httpRes: Response) {
  if (!assertServiceToken({ get: (name) => nestHeader(httpReq, name) })) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const mig = await computePrismaMigrationHash(prisma);
  const freeHint = process.env.ERA_PLACEMENT_DISK_FREE_BYTES?.trim();
  const freeBytes = freeHint ? Number(freeHint) : null;
  return sendJson(httpRes, {
    ok: true,
    migrationHash: mig.hash,
    migrationCount: mig.migrationCount,
    freeBytes: freeBytes != null && Number.isFinite(freeBytes) ? freeBytes : null,
    loginPath: "/login",
    healthPath: "/api/health",
  });
}


@Controller()
export class InternalV1PlacementPreflightController {
  @Get("api/internal/v1/placement/preflight")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!assertServiceToken({ get: (name) => nestHeader(httpReq, name) })) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    return preflight(httpReq, httpRes);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/internal/v1/placement/preflight")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  return preflight(httpReq, httpRes);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
