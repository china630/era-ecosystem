import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { cancelProcedureOrder } from "@/domain/procedure/procedure-attendance.service";
import { cancelProposedProcedureOrder, createReplacementProcedureOrder, findProcedureTypeFullByCode, getClinicalEpisodeById, listBulkCancelProcedureTargets } from "@/domain/procedure/procedure-order.service";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { placeOrPinOrders } from "@/domain/procedure/place-or-pin-orders";
import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";


const bodySchema = z.object({
  episodeId: z.string().optional(),
  patientRefId: z.string().optional(),
  procedureCode: z.string().optional(),
  from: z.string().optional(),
  reason: z.string().min(1),
  replaceWithCode: z.string().optional(),
});

/**
 * Mass-cancel future SCHEDULED/PROPOSED orders for an episode or patient.
 * Optional replaceWithCode creates PROPOSED substitutes and places them.
 */

@Controller()
export class ProceduresBulkCancelController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/bulk-cancel")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return clinicBody(denied);

    const body = bodySchema.parse(httpReq.body);
    if (!body.episodeId && !body.patientRefId) {
      throw new HttpException({ error: "episodeId or patientRefId required" }, 400);
    }

    let patientRefId = body.patientRefId;
    let reservationId: string | null | undefined;
    if (body.episodeId) {
      const episode = await getClinicalEpisodeById(body.episodeId);
      if (!episode) throw new HttpException({ error: "Episode not found" }, 404);
      patientRefId = episode.patientRefId ?? patientRefId;
      reservationId = episode.reservationId;
    }
    if (!patientRefId) throw new HttpException({ error: "patientRefId required" }, 400);

    const from = body.from ? new Date(body.from) : new Date();
    const where = {
      patientRefId,
      status: { in: ["SCHEDULED", "PROPOSED"] as ("SCHEDULED" | "PROPOSED")[] },
      scheduledAt: { gte: from },
      ...(body.procedureCode ? { procedureCode: body.procedureCode } : {}),
      ...(reservationId ? { reservationId } : {}),
    };

    const targets = await listBulkCancelProcedureTargets(where);

    let cancelled = 0;
    for (const t of targets) {
      if (t.status === "PROPOSED") {
        await cancelProposedProcedureOrder(t.id, {
          cancelledByUserId: session.sub,
          reason: body.reason,
        });
        await releaseProcedureOccupancy([t.id]);
        cancelled++;
      } else {
        await cancelProcedureOrder(
          t.id,
          { userId: session.sub, canOverrideCheckIn: true },
          body.reason,
        );
        cancelled++;
      }
    }

    let replaced = 0;
    let placed = 0;
    if (body.replaceWithCode && targets.length > 0) {
      const pt = await findProcedureTypeFullByCode(body.replaceWithCode);
      if (!pt) throw new HttpException({ error: `Unknown replaceWithCode ${body.replaceWithCode}` }, 400);

      if (body.episodeId) {
        const { procedureLaneDenial } = await import("@/domain/sanatorium/lane-gates");
        const denied = await procedureLaneDenial(body.episodeId);
        if (denied) throw new HttpException({ error: denied.message, ...{ code: denied.code } }, 409);
      }

      const newIds: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        const src = targets[i];
        const clinicalEpisodeId =
          body.episodeId ??
          (await stampEpisodeOnCreate({
            patientRefId,
            reservationId,
          }));
        const created = await createReplacementProcedureOrder({
          patientRefId,
          clinicalEpisodeId: clinicalEpisodeId ?? undefined,
          procedureType: pt,
          scheduledAt: new Date(from.getTime() + i * 60_000),
          endsAt: new Date(from.getTime() + (i + 1) * 60_000),
          sequenceIndex: src.sequenceIndex ?? i,
          bodyPart: src.bodyPart ?? undefined,
          reservationId: reservationId ?? undefined,
        });
        newIds.push(created.id);
        replaced++;
      }
      placed = (
        await placeOrPinOrders(newIds, {
          confirmedByUserId: session.sub,
        })
      ).placed;
    }

    return { cancelled, replaced, placed };
  
        });
  }
}
