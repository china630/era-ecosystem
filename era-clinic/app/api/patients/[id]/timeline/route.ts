import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  getPatientTimeline,
  type TimelineEventType,
} from "@/domain/patient/patient-timeline.service";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  types: z.string().optional(),
  limitDays: z.coerce.number().int().min(1).max(365).optional(),
});

const TYPE_SET = new Set<TimelineEventType>([
  "appointment",
  "visit",
  "lab_order",
  "procedure",
  "episode",
]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = await ctx.params;
    const exists = await prisma.patientRef.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return jsonError("Not found", 404);

    const url = new URL(req.url);
    const query = querySchema.parse({
      types: url.searchParams.get("types") ?? undefined,
      limitDays: url.searchParams.get("limitDays") ?? undefined,
    });
    const types = query.types
      ? (query.types
          .split(",")
          .map((t) => t.trim())
          .filter((t): t is TimelineEventType => TYPE_SET.has(t as TimelineEventType)) as TimelineEventType[])
      : undefined;

    return jsonOk(
      await getPatientTimeline(id, {
        types: types?.length ? types : undefined,
        limitDays: query.limitDays,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
