import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
} from "../../bridge";
import { computePrismaMigrationHash } from "@era/satellite-kit/placement";
import { prisma } from "@/lib/prisma";


function unauthorized(): never {
  throw new HttpException({ error: "Unauthorized" }, 401);
}

async function preflight(request: Request) {
  if (!assertServiceToken(request)) unauthorized();
  const mig = await computePrismaMigrationHash(prisma);
  const freeHint = process.env.ERA_PLACEMENT_DISK_FREE_BYTES?.trim();
  const freeBytes = freeHint ? Number(freeHint) : null;
  return {
    ok: true,
    migrationHash: mig.hash,
    migrationCount: mig.migrationCount,
    freeBytes: freeBytes != null && Number.isFinite(freeBytes) ? freeBytes : null,
    loginPath: "/login",
    healthPath: "/api/health",
  };
}

function assertServiceToken(request: Request): boolean {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const auth = request.get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

@Controller()
export class InternalV1PlacementPreflightController {

  @Get("api/internal/v1/placement/preflight")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => preflight(httpReq));
  }

  @Post("api/internal/v1/placement/preflight")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => preflight(httpReq));
  }
}
