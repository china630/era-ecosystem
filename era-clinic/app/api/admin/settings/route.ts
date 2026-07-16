import { z } from "zod";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { assertClinicAdminRead, assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  getClinicSettings,
  updateClinicSettings,
} from "@/domain/settings/settings.service";
import {
  PRESETS_COOKIE,
  serializePresetsCookie,
} from "@/domain/presets/preset-cookie";
import { isClinicPreset } from "@/domain/presets/clinic-presets";

const patchSchema = z.object({
  clinicName: z.string().min(1).optional(),
  enabledPresets: z.array(z.string()).min(1).optional(),
  programSchedulingMode: z.enum(["ON_CHECKIN", "AFTER_CHECKUP"]).optional(),
  schedulingSlotMinutes: z.number().int().min(1).max(60).optional(),
  procedureOverQuotaPolicy: z
    .enum(["CHARGE_FOLIO", "BLOCK", "WARN_ONLY"])
    .optional(),
  patientCardResultsPreview: z.number().int().min(1).max(50).optional(),
  patientCardPlanPreview: z.number().int().min(1).max(50).optional(),
  patientCardHistoryPageSize: z.number().int().min(10).max(100).optional(),
  patientCardPlanPageSize: z.number().int().min(10).max(100).optional(),
});

export async function GET() {
  try {
    const guard = await assertClinicAdminRead();
    if (guard.error) return guard.error;
    return jsonOk(await getClinicSettings());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = patchSchema.parse(await req.json());
    if (body.enabledPresets?.some((p) => !isClinicPreset(p))) {
      return jsonError("Invalid preset", 400);
    }
    const row = await updateClinicSettings(body);
    const settings = await getClinicSettings();
    const res = jsonOk(settings);
    res.cookies.set(PRESETS_COOKIE, serializePresetsCookie(settings.enabledPresets), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
