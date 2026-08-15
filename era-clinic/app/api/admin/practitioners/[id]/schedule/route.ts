import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  getPractitionerById,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";
import {
  getPractitionerSchedule,
  replacePractitionerSchedule,
} from "@/domain/appointment/practitioner-schedule-admin.service";

const ruleSchema = z
  .object({
    pattern: z.enum(["WEEKLY", "WEEK_PARITY", "MONTH_DAY_PARITY", "CYCLE"]),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    parity: z.enum(["EVEN", "ODD"]).nullable().optional(),
    cycleAnchor: z.string().optional().nullable(),
    cycleLengthDays: z.number().int().min(1).max(60).nullable().optional(),
    cycleOffsets: z.array(z.number().int().min(0)).optional(),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
    effectiveFrom: z.string().nullable().optional(),
    effectiveTo: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((r) => r.endMinute > r.startMinute, {
    message: "endMinute must be greater than startMinute",
  })
  .refine((r) => r.pattern !== "CYCLE" || (!!r.cycleAnchor && !!r.cycleLengthDays), {
    message: "CYCLE requires cycleAnchor and cycleLengthDays",
  });

const exceptionSchema = z
  .object({
    date: z.string().min(10),
    kind: z.enum(["DAY_OFF", "EXTRA_SHIFT", "CUSTOM_HOURS"]),
    startMinute: z.number().int().min(0).max(1440).nullable().optional(),
    endMinute: z.number().int().min(0).max(1440).nullable().optional(),
    note: z.string().max(200).nullable().optional(),
  })
  .refine(
    (e) =>
      e.kind === "DAY_OFF" ||
      (typeof e.startMinute === "number" &&
        typeof e.endMinute === "number" &&
        e.endMinute > e.startMinute),
    { message: "EXTRA_SHIFT / CUSTOM_HOURS require a valid start/end window" },
  );

const putSchema = z.object({
  rules: z.array(ruleSchema),
  exceptions: z.array(exceptionSchema),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) return jsonError("Not found", 404);
    return jsonOk(await getPractitionerSchedule(id));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) return jsonError("Not found", 404);
    const body = putSchema.parse(await req.json());
    const result = await replacePractitionerSchedule(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitionerSchedule",
      id,
      "REPLACE",
      { rules: body.rules.length, exceptions: body.exceptions.length },
    );
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
