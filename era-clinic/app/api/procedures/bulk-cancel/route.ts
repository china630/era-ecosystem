import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cancelProcedureOrder } from "@/domain/procedure/procedure-attendance.service";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";

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
export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await req.json());
    if (!body.episodeId && !body.patientRefId) {
      return jsonError("episodeId or patientRefId required", 400);
    }

    let patientRefId = body.patientRefId;
    let reservationId: string | null | undefined;
    if (body.episodeId) {
      const episode = await prisma.clinicalEpisode.findUnique({
        where: { id: body.episodeId },
      });
      if (!episode) return jsonError("Episode not found", 404);
      patientRefId = episode.patientRefId ?? patientRefId;
      reservationId = episode.reservationId;
    }
    if (!patientRefId) return jsonError("patientRefId required", 400);

    const from = body.from ? new Date(body.from) : new Date();
    const where = {
      patientRefId,
      status: { in: ["SCHEDULED", "PROPOSED"] as ("SCHEDULED" | "PROPOSED")[] },
      scheduledAt: { gte: from },
      ...(body.procedureCode ? { procedureCode: body.procedureCode } : {}),
      ...(reservationId ? { reservationId } : {}),
    };

    const targets = await prisma.procedureOrder.findMany({
      where,
      select: { id: true, status: true, procedureCode: true, bodyPart: true, sequenceIndex: true },
      orderBy: { scheduledAt: "asc" },
    });

    let cancelled = 0;
    for (const t of targets) {
      if (t.status === "PROPOSED") {
        await prisma.procedureOrder.update({
          where: { id: t.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledByUserId: session.sub,
            cancelReason: body.reason,
          },
        });
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
      const pt = await prisma.procedureType.findFirst({
        where: { code: body.replaceWithCode },
      });
      if (!pt) return jsonError(`Unknown replaceWithCode ${body.replaceWithCode}`, 400);

      const newIds: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        const src = targets[i];
        const created = await prisma.procedureOrder.create({
          data: {
            organizationId: requestOrganizationId(),
            patientRefId,
            procedureCode: pt.code,
            procedureName: pt.name,
            procedureTypeId: pt.id,
            scheduledAt: new Date(from.getTime() + i * 60_000),
            endsAt: new Date(from.getTime() + (i + 1) * 60_000),
            sequenceIndex: src.sequenceIndex ?? i,
            bodyPart: src.bodyPart ?? pt.bodyPart ?? undefined,
            reservationId: reservationId ?? undefined,
            status: "PROPOSED",
          },
        });
        newIds.push(created.id);
        replaced++;
      }
      placed = await placeConfirmedProcedures(newIds, {
        confirmedByUserId: session.sub,
      });
    }

    return jsonOk({ cancelled, replaced, placed });
  } catch (err) {
    return handleRouteError(err);
  }
}
