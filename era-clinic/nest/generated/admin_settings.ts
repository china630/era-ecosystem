import { z } from "zod";
import { jsonOk } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getClinicSettings, updateClinicSettings } from "@/domain/settings/settings.service";
import { PRESETS_COOKIE, serializePresetsCookie } from "@/domain/presets/preset-cookie";
import { isClinicPreset } from "@/domain/presets/clinic-presets";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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
  saturdayEndHour: z.number().int().min(1).max(24).optional(),
  shortenedDayStartHour: z.number().int().min(0).max(23).optional(),
  shortenedDayEndHour: z.number().int().min(1).max(24).optional(),
  bathDayModes: z
    .array(
      z.object({
        code: z.string().min(1).max(16),
        baths: z.number().int().min(1).max(14),
        rest: z.number().int().min(0).max(7),
      }),
    )
    .optional(),
  defaultBathMode: z.string().min(1).max(16).optional(),
  closedDaySpendsOwedRest: z.boolean().optional(),
  closedDayResetsOpenStreak: z.boolean().optional(),
  weeklyNaftalanCap: z.number().int().min(0).max(14).optional(),
  defaultProcedureGapMinutes: z.number().int().min(0).max(240).optional(),
  peakModeEnabled: z.boolean().optional(),
  peakDayEndHour: z.number().int().min(1).max(24).optional(),
  checkInRequiresQr: z.boolean().optional(),
  procedureCheckInMode: z.enum(["QR", "CODE", "MANUAL"]).optional(),
  procedureCheckInWindow: z.enum(["STRICT", "SAME_DAY"]).optional(),
  procedureCheckInSameDayUntil: z.string().datetime().nullable().optional(),
  receptionProcedureCheckIn: z.boolean().optional(),
  autoNoShowAfterMin: z.number().int().min(1).max(1440).nullable().optional(),
  patientCardResultsPreview: z.number().int().min(1).max(50).optional(),
  patientCardPlanPreview: z.number().int().min(1).max(50).optional(),
  patientCardHistoryPageSize: z.number().int().min(10).max(100).optional(),
  patientCardPlanPageSize: z.number().int().min(10).max(100).optional(),
  doctorBonusPercentInHouse: z.number().min(0).max(100).optional(),
  doctorBonusPercentWalkIn: z.number().min(0).max(100).optional(),
  hotelFolioRevenueCode: z.string().max(32).nullable().optional(),
  noShowKeepsCharge: z.boolean().optional(),
  noShowBurnsQuota: z.boolean().optional(),
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
  printModalitySignersJson: z.string().max(8000).nullable().optional(),
  checkupSectionsJson: z.string().nullable().optional(),
  extraProcedureRoute: z.enum(["PLAN_BEFORE_PAY", "HOLD_UNTIL_PAY", "SHOW_ON_PLAN"]).optional(),
  laneGate: z
    .object({
      procedures: z.object({
        anamnesis: z.boolean(),
        complaints: z.boolean(),
        diagnoses: z.boolean(),
      }),
      labs: z.object({
        anamnesis: z.boolean(),
        complaints: z.boolean(),
        diagnoses: z.boolean(),
      }),
      visits: z.object({
        anamnesis: z.boolean(),
        complaints: z.boolean(),
        diagnoses: z.boolean(),
      }),
    })
    .optional(),
  procedurePrintExtraLang: z.enum(["az", "ru", "en"]).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/settings", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return sendJson(httpRes, await getClinicSettings());
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/settings", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = patchSchema.parse(httpReq.body);
    if (body.enabledPresets?.some((p) => !isClinicPreset(p))) {
      return sendJson(httpRes, { error: "Invalid preset" }, 400);
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
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
