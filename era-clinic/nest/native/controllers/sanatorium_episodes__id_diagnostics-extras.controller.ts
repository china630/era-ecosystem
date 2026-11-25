import { Controller, Delete, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { jsonError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { deletePendingDiagnostic, listPendingDiagnostics, payDiagnosticsExtras, prescribeDiagnosticsExtras } from "@/domain/sanatorium/diagnostics-extras.service";
import { listExtraUnitPrices } from "@/domain/sanatorium/extras-assign.service";


const prescribeSchema = z.object({
  lines: z
    .array(
      z.object({
        serviceCode: z.string().min(1),
        qty: z.number().int().positive().max(40),
        note: z.string().max(2000).optional().nullable(),
        scheduledAt: z.string().max(32).optional().nullable(),
      }),
    )
    .min(1),
});

const paySchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["lab", "visit"]),
      }),
    )
    .min(1),
});

function mapError(err: unknown) {
  if (err instanceof PackageAssignError) {
    return clinicBody(jsonError(err.message, err.status, { code: err.code }));
  }
  return null;
}

@Controller()
export class SanatoriumEpisodesIdDiagnosticsExtrasController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/diagnostics-extras")
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
    const [items, prices] = await Promise.all([
      listPendingDiagnostics(id),
      listExtraUnitPrices(),
    ]);
    return { items, prices };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const mapped = mapError(err);
    if (mapped) return mapped;
    return clinicBody(handleRouteError(err));
  }

        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/diagnostics-extras")
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
    const raw = httpReq.body;
    if (raw?.action === "pay") {
      const body = paySchema.parse(raw);
      const result = await payDiagnosticsExtras(body.lines, session.sub);
      return result;
    }
    const body = prescribeSchema.parse(raw);
    const result = await prescribeDiagnosticsExtras(id, body.lines, session.sub);
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const mapped = mapError(err);
    if (mapped) return mapped;
    return clinicBody(handleRouteError(err));
  }

        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/sanatorium/episodes/:id/diagnostics-extras")
  @HttpCode(200)
  async delete_2(
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
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const rowId = url.searchParams.get("id");
    const kind = url.searchParams.get("kind");
    if (!rowId || (kind !== "lab" && kind !== "visit")) {
      throw new HttpException({ error: "id and kind=lab|visit required" }, 400);
    }
    await deletePendingDiagnostic(kind, rowId, { userId: session.sub });
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const mapped = mapError(err);
    if (mapped) return mapped;
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
