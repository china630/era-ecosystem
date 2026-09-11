import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  deleteDayOverride,
  listDayOverrides,
  upsertDayOverride,
} from "@/domain/staff/staff-duty-roster.service";

const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const upsertSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  dutyDate: z.string().min(10),
  procedureTypeId: z.string().min(1),
  practitionerId: z.string().min(1),
  note: z.string().max(200).nullable().optional(),
});

async function rosterForbidden(
  session: Awaited<ReturnType<typeof getRouteSession>>,
) {
  return requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER);
}

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const url = new URL(req.url);
    const yearMonth = url.searchParams.get("yearMonth") ?? "";
    const staffKindRaw = url.searchParams.get("staffKind") ?? "NURSE";
    const dutyDate = url.searchParams.get("dutyDate") ?? undefined;
    return jsonOk(
      await listDayOverrides({
        yearMonth,
        staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
        dutyDate,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const body = upsertSchema.parse(await req.json());
    const row = await upsertDayOverride({
      ...body,
      createdByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyDayOverride",
      row.id,
      "UPSERT",
      {
        yearMonth: body.yearMonth,
        dutyDate: body.dutyDate,
        procedureTypeId: body.procedureTypeId,
        practitionerId: body.practitionerId,
      },
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return jsonError("id required", 400);
    }
    await deleteDayOverride(id);
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyDayOverride",
      id,
      "DELETE",
    );
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
