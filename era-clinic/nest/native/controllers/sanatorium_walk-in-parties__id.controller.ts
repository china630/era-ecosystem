import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { WalkInPartyError, addWalkInPartyGuest, addWalkInPartyLine, getWalkInParty, listWalkInPartyJournal, removeWalkInPartyGuest, removeWalkInPartyLine, sendWalkInPartyToCashier, updateWalkInPartyGuest } from "@/domain/sanatorium/walk-in-party.service";


const sex = z.enum(["MALE", "FEMALE"]);

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("addGuest"),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    patientRefId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("updateGuest"),
    guestId: z.string().min(1),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
  z.object({
    action: z.literal("removeGuest"),
    guestId: z.string().min(1),
  }),
  z.object({
    action: z.literal("addLine"),
    guestId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
    code: z.string().min(1),
    qty: z.number().int().min(1).max(20).optional(),
    practitionerId: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    physioFields: z.record(z.unknown()).nullable().optional(),
    siteIds: z.array(z.string()).optional(),
    siteApplyMode: z.enum(["TURN", "TOGETHER"]).nullable().optional(),
    siteLaterality: z
      .record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable())
      .optional(),
  }),
  z.object({
    action: z.literal("removeLine"),
    guestId: z.string().min(1),
    lineId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
  }),
  z.object({ action: z.literal("send") }),
]);

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return clinicBody(jsonError(err.message, err.status, { code: err.code }));
  return clinicBody(handleRouteError(err));
}

@Controller()
export class SanatoriumWalkInPartiesIdController {

  @Get("api/sanatorium/walk-in-parties/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertOpsApiPermission(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const journal = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("journal") === "1";
    return journal ? await listWalkInPartyJournal(id) : await getWalkInParty(id);
  } catch (err) {
    return fail(err);
  }

        });
  }

  @Patch("api/sanatorium/walk-in-parties/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertOpsApiPermission(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const actor = { userId: guard.session.sub, actorName: guard.session.fullName, request: expressKitHeaders(httpReq) };
    if (body.action === "addGuest") return await addWalkInPartyGuest(id, body, actor);
    if (body.action === "updateGuest") {
      return await updateWalkInPartyGuest(id, body.guestId, body, actor);
    }
    if (body.action === "removeGuest") {
      return await removeWalkInPartyGuest(id, body.guestId, actor);
    }
    if (body.action === "addLine") return await addWalkInPartyLine(id, body.guestId, body, actor);
    if (body.action === "removeLine") {
      return await removeWalkInPartyLine(id, body.guestId, body.lineId, body.kind, actor);
    }
    return await sendWalkInPartyToCashier(id, actor);
  } catch (err) {
    return fail(err);
  }

        });
  }
}
