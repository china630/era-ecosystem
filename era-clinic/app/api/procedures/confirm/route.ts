import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import {
  fifoConfirmBlockedReason,
  procedureConfirmHttpStatus,
} from "@/lib/sanatorium-fifo-gates";
import { day1ConfirmSoftWarn } from "@/lib/sanatorium-day1";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
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
    const session = await getRouteSession();
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

    // Soft warn only — never 4xx for >3 (contra / doctor may need 4).
    const softWarn = day1ConfirmSoftWarn(body.orderIds.length);

    const placed = await placeConfirmedProcedures(body.orderIds, {
      confirmedByUserId: session.sub,
    });
    return jsonOk({
      placed,
      orderIds: body.orderIds,
      ...(softWarn ? { softWarn } : {}),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
