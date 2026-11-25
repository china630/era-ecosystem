import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { jsonError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError, assignPackageMenuLines, getPackageAssignSnapshot, applyPreferredMasseurs, placeProposedOnCheckoutMorning, releaseUnseatedPackageOrders } from "@/domain/sanatorium/package-assign.service";
import { readUiLocale } from "@/lib/request-locale";
import { parseBakuDateTime } from "@/lib/baku-day";
import { recordClinicAudit } from "@/lib/satellite-audit";


const lineSchema = z.object({
  procedureCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  note: z.string().max(2000).optional().nullable(),
  bodyPart: z.string().max(64).optional().nullable(),
  physioFields: z.record(z.unknown()).optional().nullable(),
  siteIds: z.array(z.string()).optional(),
  siteApplyMode: z.enum(["TURN", "TOGETHER"]).optional().nullable(),
  siteLaterality: z
    .record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable())
    .optional(),
  /** Burn PHYSIO_POOL / PARAFFIN_POOL balance; procedureCode stays the real SKU. */
  burnPoolCode: z.string().min(1).optional().nullable(),
  preferredPractitionerId: z.string().min(1).nullable().optional(),
});

const staffPrefSchema = z.object({
  procedureCode: z.string().min(1),
  practitionerId: z.string().min(1).nullable(),
});

const assignSchema = z
  .object({
    lines: z.array(lineSchema).default([]),
    staffPrefs: z.array(staffPrefSchema).optional(),
    checkoutMorning: z.boolean().optional(),
    releaseUnseated: z.boolean().optional(),
    startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    bathLayout: z.enum(["continue", "fresh"]).optional(),
  })
  .refine(
    (body) =>
      body.checkoutMorning === true ||
      body.releaseUnseated === true ||
      body.lines.length > 0 ||
      (body.staffPrefs?.length ?? 0) > 0,
    { message: "lines required" },
  );

function mapAssignError(err: unknown) {
  if (err instanceof PackageAssignError) {
    return clinicBody(jsonError(err.message, err.status, { code: err.code, misses: err.misses }));
  }
  return null;
}

@Controller()
export class SanatoriumEpisodesIdPackageAssignController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/package-assign")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const locale = await readUiLocale(clinicRoute(httpReq));
    const snap = await getPackageAssignSnapshot(id, locale);
    return snap;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const mapped = mapAssignError(err);
    if (mapped) return mapped;
    return clinicBody(handleRouteError(err));
  }

        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/package-assign")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = assignSchema.parse(httpReq.body);
    if (body.releaseUnseated && body.lines.length === 0) {
      const released = await releaseUnseatedPackageOrders(id);
      return { released };
    }
    if (body.checkoutMorning && body.lines.length === 0) {
      const seated = await placeProposedOnCheckoutMorning(id, session.sub);
      await releaseUnseatedPackageOrders(id);
      return seated;
    }
    const startAt =
      body.startOn && body.startHour != null
        ? parseBakuDateTime(body.startOn, `${String(body.startHour).padStart(2, "0")}:00`)
        : null;
    const result =
      body.lines.length > 0
        ? await assignPackageMenuLines(id, body.lines, {
            confirmedByUserId: session.sub,
            startAt,
            bathLayout: body.bathLayout,
          })
        : { placed: 0, softWarn: null, orderIds: [] as string[], misses: [] as Array<{ ymd: string; procedureCode: string; procedureName: string; reason: string; staffName?: string }> };
    if (body.staffPrefs && body.staffPrefs.length > 0) {
      const applied = await applyPreferredMasseurs(id, body.staffPrefs, {
        confirmedByUserId: session.sub,
        startAt,
      });
      result.misses = [...(result.misses ?? []), ...applied.misses];
    }
    if (body.lines.length > 0 || (body.staffPrefs?.length ?? 0) > 0) {
      await recordClinicAudit(
        { userId: session.sub, request: expressKitHeaders(httpReq) },
        "ClinicalEpisode",
        id,
        "package_assign",
        {
          startOn: body.startOn ?? null,
          startHour: body.startHour ?? result.rememberedHour ?? null,
          searchHour: result.searchHour ?? null,
          lineCount: body.lines.length,
          placed: result.placed,
          missCount: result.misses?.length ?? 0,
          staffPrefCount: body.staffPrefs?.length ?? 0,
          seatMisses: result.seatMisses ?? [],
        },
      );
    }
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const mapped = mapAssignError(err);
    const message = err instanceof Error ? err.message : "Package seating failed";
    const code =
      err && typeof err === "object" && "code" in err && typeof (err as { code?: string }).code === "string"
        ? (err as { code: string }).code
        : "PLACE_FAILED";
    try {
      const { id } = httpReq.params;
      if (session) {
        await recordClinicAudit(
          { userId: session.sub, request: expressKitHeaders(httpReq) },
          "ClinicalEpisode",
          id,
          "package_assign_failed",
          { code, message },
        );
      }
    } catch {
      /* the seating error is the response; audit must not replace it */
    }
    if (mapped) return mapped;
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
