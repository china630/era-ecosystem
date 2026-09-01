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
  approveDutyRoster,
  copyDutyRosterFromPrevious,
  getOrCreateDutyRoster,
  saveDutyRoster,
} from "@/domain/staff/staff-duty-roster.service";

const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const saveSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  note: z.string().max(500).nullable().optional(),
  lines: z.array(
    z.object({
      procedureTypeId: z.string().min(1),
      practitionerId: z.string().nullable().optional(),
      stable: z.boolean().optional(),
      note: z.string().max(200).nullable().optional(),
    }),
  ),
});

const monthSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
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
    const parsed = monthSchema.parse({
      yearMonth,
      staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
    });
    return jsonOk(await getOrCreateDutyRoster(parsed));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const body = saveSchema.parse(await req.json());
    const result = await saveDutyRoster(body);
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyRoster",
      result.roster.id,
      "UPDATE",
      { yearMonth: body.yearMonth, lines: body.lines.length },
    );
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const body = z
      .object({
        action: z.enum(["approve", "copyPrevious"]),
        yearMonth: z.string(),
        staffKind: staffKindSchema.optional(),
      })
      .parse(await req.json());

    if (body.action === "copyPrevious") {
      const result = await copyDutyRosterFromPrevious(body);
      await recordClinicAudit(
        { userId: session!.sub, request: req },
        "staffDutyRoster",
        result.roster.id,
        "COPY_PREVIOUS",
        { yearMonth: body.yearMonth },
      );
      return jsonOk(result);
    }

    const result = await approveDutyRoster({
      yearMonth: body.yearMonth,
      staffKind: body.staffKind,
      approvedByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyRoster",
      result.roster.id,
      "APPROVE",
      { yearMonth: body.yearMonth },
    );
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
