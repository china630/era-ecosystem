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
import { fifoConfirmBlockedReason, procedureConfirmHttpStatus } from "@/lib/sanatorium-fifo-gates";
import { countEpisodesAssignedToPractitioner, findProposedProcedureOrdersByIds, listProposedProcedureOrdersForPatient } from "@/domain/procedure/procedure-order.service";
import { placeOrPinOrders } from "@/domain/procedure/place-or-pin-orders";
import { resolveClinicDataScope, episodeAssignedToPractitionerWhere } from "@/lib/auth/clinic-data-scope";


const bodySchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
});

/** Doctor confirms PROPOSED orders → FIFO place on resources. */

@Controller()
export class ProceduresConfirmController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/confirm")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return clinicBody(denied);

    const body = bodySchema.parse(httpReq.body);

    const selected = await findProposedProcedureOrdersByIds(body.orderIds);
    if (selected.length === 0) {
      throw new HttpException({ error: "No PROPOSED orders to confirm" }, 404);
    }

    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) {
        throw new HttpException({ error: "Forbidden" }, 403);
      }
      const episodeIds = [
        ...new Set(
          selected
            .map((o) => o.clinicalEpisodeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (episodeIds.length === 0) {
        throw new HttpException({ error: "Orders are not linked to a care course" }, 409);
      }
      const allowed = await countEpisodesAssignedToPractitioner(
        episodeIds,
        episodeAssignedToPractitionerWhere(scope.practitionerId),
      );
      if (allowed !== episodeIds.length) {
        throw new HttpException({ error: "Not on care team for this course", ...{
          code: "CARE_TEAM_REQUIRED",
        } }, 403);
      }
    }

    const patientRefId = selected[0].patientRefId;
    const proposedForPatient = await listProposedProcedureOrdersForPatient(patientRefId);
    const fifoBlock = fifoConfirmBlockedReason({
      confirmingIds: body.orderIds,
      proposedForPatient,
    });
    if (fifoBlock) {
      throw new HttpException({ error: fifoBlock }, procedureConfirmHttpStatus(fifoBlock));
    }

    const placement = await placeOrPinOrders(body.orderIds, {
      confirmedByUserId: session.sub,
    });
    const misses = placement.failures.map((row) => ({
      ymd: row.ymd ?? "",
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      reason: row.reason,
    }));
    if (placement.placed < 1) {
      const onlyCabinSex =
        misses.length > 0 && misses.every((row) => row.reason === "cabin_sex");
      const onlyMissingCabin =
        placement.missingCabinNames.length > 0 &&
        (misses.length === 0 || misses.every((row) => row.reason === "no_cabin"));
      if (onlyCabinSex) {
        throw new HttpException({ error: 
          [...new Set(misses.map((row) => row.procedureName))].join(", "), ...{ code: "CABIN_SEX", misses } }, 409);
      }
      if (onlyMissingCabin) {
        throw new HttpException({ error: placement.missingCabinNames.join(", "), ...{
          code: "NO_CABIN",
          misses,
        } }, 409);
      }
      throw new HttpException({ error: 
        misses.map((row) => row.procedureName || row.procedureCode).join(", ") ||
          placement.missingCabinNames.join(", ") ||
          "Could not place sessions", ...{ code: "PLACE_FAILED", misses } }, 409);
    }
    return {
      placed: placement.placed,
      orderIds: placement.placedIds,
      ...(misses.length > 0 ? { misses } : {}),
    };
  
        });
  }
}
