import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import {
  fifoConfirmBlockedReason,
  procedureConfirmHttpStatus,
} from "@/lib/sanatorium-fifo-gates";
import { placeOrPinOrders } from "@/domain/procedure/place-or-pin-orders";
import {
  resolveClinicDataScope,
  episodeAssignedToPractitionerWhere,
} from "@/lib/auth/clinic-data-scope";

const bodySchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
});

/** Doctor confirms PROPOSED orders → FIFO place on resources. */
export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;

    const body = bodySchema.parse(await req.json());

    const selected = await prisma.procedureOrder.findMany({
      where: { id: { in: body.orderIds }, status: "PROPOSED" },
      select: {
        id: true,
        patientRefId: true,
        sequenceIndex: true,
        clinicalEpisodeId: true,
        schedulingMode: true,
      },
    });
    if (selected.length === 0) {
      return jsonError("No PROPOSED orders to confirm", 404);
    }

    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) {
        return jsonError("Forbidden", 403);
      }
      const episodeIds = [
        ...new Set(
          selected
            .map((o) => o.clinicalEpisodeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (episodeIds.length === 0) {
        return jsonError("Orders are not linked to a care course", 409);
      }
      const allowed = await prisma.clinicalEpisode.count({
        where: {
          id: { in: episodeIds },
          ...episodeAssignedToPractitionerWhere(scope.practitionerId),
        },
      });
      if (allowed !== episodeIds.length) {
        return jsonError("Not on care team for this course", 403, {
          code: "CARE_TEAM_REQUIRED",
        });
      }
    }

    const patientRefId = selected[0].patientRefId;
    const proposedForPatient = await prisma.procedureOrder.findMany({
      where: { patientRefId, status: "PROPOSED" },
      select: { id: true, sequenceIndex: true },
      orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
    });
    const fifoBlock = fifoConfirmBlockedReason({
      confirmingIds: body.orderIds,
      proposedForPatient,
    });
    if (fifoBlock) {
      return jsonError(fifoBlock, procedureConfirmHttpStatus(fifoBlock));
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
        return jsonError(
          [...new Set(misses.map((row) => row.procedureName))].join(", "),
          409,
          { code: "CABIN_SEX", misses },
        );
      }
      if (onlyMissingCabin) {
        return jsonError(placement.missingCabinNames.join(", "), 409, {
          code: "NO_CABIN",
          misses,
        });
      }
      return jsonError(
        misses.map((row) => row.procedureName || row.procedureCode).join(", ") ||
          placement.missingCabinNames.join(", ") ||
          "Could not place sessions",
        409,
        { code: "PLACE_FAILED", misses },
      );
    }
    return jsonOk({
      placed: placement.placed,
      orderIds: placement.placedIds,
      ...(misses.length > 0 ? { misses } : {}),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
