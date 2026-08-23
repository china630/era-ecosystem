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
  defaultAppointmentSlotMinutes: z
    .number()
    .int()
    .min(5)
    .max(120)
    .optional(),
  procedureOverQuotaPolicy: z
    .enum(["CHARGE_FOLIO", "BLOCK", "WARN_ONLY"])
    .optional(),
  dayStartHour: z.number().int().min(0).max(23).optional(),
  dayEndHour: z.number().int().min(1).max(24).optional(),
  lunchStartHour: z.number().int().min(0).max(23).optional(),
  lunchEndHour: z.number().int().min(1).max(24).optional(),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  defaultProcedureGapMinutes: z.number().int().min(0).max(240).optional(),
  peakModeEnabled: z.boolean().optional(),
  peakDayEndHour: z.number().int().min(1).max(24).optional(),
  genderSessionMode: z.enum(["OFF", "SPLIT_BY_LUNCH", "CUSTOM_WINDOWS"]).optional(),
  genderSessionFemaleFirst: z.boolean().optional(),
  genderSessionUnknown: z.enum(["BLOCK", "ALLOW_BOTH"]).optional(),
  genderSessionFemaleStartHour: z.number().int().min(0).max(23).nullable().optional(),
  genderSessionFemaleEndHour: z.number().int().min(0).max(24).nullable().optional(),
  genderSessionMaleStartHour: z.number().int().min(0).max(23).nullable().optional(),
  genderSessionMaleEndHour: z.number().int().min(0).max(24).nullable().optional(),
  checkInRequiresQr: z.boolean().optional(),
  procedureCheckInMode: z.enum(["QR", "CODE", "MANUAL"]).optional(),
  autoNoShowAfterMin: z.number().int().min(1).max(1440).nullable().optional(),
  patientCardResultsPreview: z.number().int().min(1).max(50).optional(),
  patientCardPlanPreview: z.number().int().min(1).max(50).optional(),
  patientCardHistoryPageSize: z.number().int().min(10).max(100).optional(),
  patientCardPlanPageSize: z.number().int().min(10).max(100).optional(),
  printLogoDataUrl: z.string().nullable().optional(),
  printClinicNameEn: z.string().nullable().optional(),
  printClinicNameRu: z.string().nullable().optional(),
  printClinicNameAz: z.string().nullable().optional(),
  printAddressEn: z.string().nullable().optional(),
  printAddressRu: z.string().nullable().optional(),
  printAddressAz: z.string().nullable().optional(),
  printPhone: z.string().nullable().optional(),
  printEmail: z.string().nullable().optional(),
  printWebsite: z.string().nullable().optional(),
  printFooterEn: z.string().nullable().optional(),
  printFooterRu: z.string().nullable().optional(),
  printFooterAz: z.string().nullable().optional(),
  printSignatureLab: z.string().nullable().optional(),
  printSignatureDoctor: z.string().nullable().optional(),
  checkupSectionsJson: z.string().nullable().optional(),
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
