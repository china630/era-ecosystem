import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { todayBakuYmd } from "@/lib/baku-day";
import { WalkInPartyError, createWalkInParty, listWalkInParties } from "@/domain/sanatorium/walk-in-party.service";


const createSchema = z.object({
  name: z.string().min(1).max(120),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return clinicBody(jsonError(err.message, err.status, { code: err.code }));
  return clinicBody(handleRouteError(err));
}

@Controller()
export class SanatoriumWalkInPartiesController {

  @Get("api/sanatorium/walk-in-parties")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertOpsApiPermission(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listWalkInParties();
  } catch (err) {
    return fail(err);
  }

        });
  }

  @Post("api/sanatorium/walk-in-parties")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertOpsApiPermission(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const party = await createWalkInParty(
      { name: body.name, visitDate: body.visitDate ?? todayBakuYmd() },
      { userId: guard.session.sub, actorName: guard.session.fullName, request: expressKitHeaders(httpReq) },
    );
    return party;
  } catch (err) {
    return fail(err);
  }

        });
  }
}
