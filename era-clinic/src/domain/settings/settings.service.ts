import { prisma } from "@/lib/prisma";
import {
  ALL_CLINIC_PRESETS,
  CLINIC_PRESET,
  isClinicPreset,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";
import { SANATORIUM_DEFAULT_SETTINGS } from "@/domain/settings/scheduling-settings";
import { parseBathDayModes, type BathModeDef } from "@/domain/planning/bath-calendar";
import type {
  ProcedureOverQuotaPolicy,
  ProgramSchedulingMode,
  ProcedureCheckInMode,
} from "@prisma/client";
import { parseExtraProcedureRoute } from "@/domain/sanatorium/extra-procedure-route";

const DEFAULT_TENANT_CODE = "default";

const CARD_DEFAULTS = {
  patientCardResultsPreview: 5,
  patientCardPlanPreview: 15,
  patientCardHistoryPageSize: 25,
  patientCardPlanPageSize: 25,
} as const;

function clampCardLimit(n: number | undefined, fallback: number, max = 100): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

export async function getDefaultTenant() {
  let tenant = await prisma.tenant.findFirst({
    where: { code: DEFAULT_TENANT_CODE },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        code: DEFAULT_TENANT_CODE,
        name: "Nafta Clinic",
        enabledPresets: [CLINIC_PRESET.SANATORIUM_CLINICAL],
        programSchedulingMode: SANATORIUM_DEFAULT_SETTINGS.programSchedulingMode,
        schedulingSlotMinutes: SANATORIUM_DEFAULT_SETTINGS.schedulingSlotMinutes,
        defaultAppointmentSlotMinutes:
          SANATORIUM_DEFAULT_SETTINGS.defaultAppointmentSlotMinutes,
        procedureOverQuotaPolicy: SANATORIUM_DEFAULT_SETTINGS.procedureOverQuotaPolicy,
        defaultBathMode: SANATORIUM_DEFAULT_SETTINGS.defaultBathMode,
        closedDaySpendsOwedRest: SANATORIUM_DEFAULT_SETTINGS.closedDaySpendsOwedRest,
        closedDayResetsOpenStreak: SANATORIUM_DEFAULT_SETTINGS.closedDayResetsOpenStreak,
        weeklyNaftalanCap: SANATORIUM_DEFAULT_SETTINGS.weeklyNaftalanCap,
      },
    });
  }
  if (!tenant) throw new Error("Failed to ensure default tenant");
  return tenant;
}

export async function getClinicSettings() {
  const tenant = await getDefaultTenant();
  return {
    clinicName: tenant.name,
    tenantId: tenant.id,
    enabledPresets: tenant.enabledPresets as ClinicPresetCode[],
    programSchedulingMode: tenant.programSchedulingMode,
    schedulingSlotMinutes: tenant.schedulingSlotMinutes,
    defaultAppointmentSlotMinutes:
      tenant.defaultAppointmentSlotMinutes ??
      SANATORIUM_DEFAULT_SETTINGS.defaultAppointmentSlotMinutes,
    procedureOverQuotaPolicy: tenant.procedureOverQuotaPolicy,
    dayStartHour: tenant.dayStartHour,
    dayEndHour: tenant.dayEndHour,
    lunchStartHour: tenant.lunchStartHour,
    lunchEndHour: tenant.lunchEndHour,
    closedWeekdays: tenant.closedWeekdays ?? [0],
    saturdayEndHour: tenant.saturdayEndHour ?? 13,
    shortenedDayEndHour: tenant.shortenedDayEndHour ?? 13,
    bathDayModes: parseBathDayModes(tenant.bathDayModesJson),
    defaultBathMode: tenant.defaultBathMode?.trim() || "3",
    closedDaySpendsOwedRest: tenant.closedDaySpendsOwedRest !== false,
    closedDayResetsOpenStreak: tenant.closedDayResetsOpenStreak !== false,
    weeklyNaftalanCap:
      tenant.weeklyNaftalanCap == null ? 5 : Math.min(14, Math.max(0, tenant.weeklyNaftalanCap)),
    defaultProcedureGapMinutes: tenant.defaultProcedureGapMinutes ?? 5,
    peakModeEnabled: tenant.peakModeEnabled ?? false,
    peakDayEndHour: tenant.peakDayEndHour ?? 22,
    checkInRequiresQr: tenant.checkInRequiresQr ?? true,
    procedureCheckInMode:
      tenant.procedureCheckInMode ??
      (tenant.checkInRequiresQr === false ? "MANUAL" : "QR"),
    autoNoShowAfterMin: tenant.autoNoShowAfterMin ?? null,
    procedureCheckInWindow:
      tenant.procedureCheckInWindow === "SAME_DAY" ? "SAME_DAY" : "STRICT",
    procedureCheckInSameDayUntil: tenant.procedureCheckInSameDayUntil
      ? tenant.procedureCheckInSameDayUntil.toISOString()
      : null,
    receptionProcedureCheckIn: tenant.receptionProcedureCheckIn !== false,
    patientCardResultsPreview:
      tenant.patientCardResultsPreview ?? CARD_DEFAULTS.patientCardResultsPreview,
    patientCardPlanPreview: tenant.patientCardPlanPreview ?? CARD_DEFAULTS.patientCardPlanPreview,
    patientCardHistoryPageSize:
      tenant.patientCardHistoryPageSize ?? CARD_DEFAULTS.patientCardHistoryPageSize,
    patientCardPlanPageSize:
      tenant.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,
    printLogoDataUrl: tenant.printLogoDataUrl ?? null,
    printClinicNameEn: tenant.printClinicNameEn ?? null,
    printClinicNameRu: tenant.printClinicNameRu ?? null,
    printClinicNameAz: tenant.printClinicNameAz ?? null,
    printAddressEn: tenant.printAddressEn ?? null,
    printAddressRu: tenant.printAddressRu ?? null,
    printAddressAz: tenant.printAddressAz ?? null,
    printPhone: tenant.printPhone ?? null,
    printEmail: tenant.printEmail ?? null,
    printWebsite: tenant.printWebsite ?? null,
    printFooterEn: tenant.printFooterEn ?? null,
    printFooterRu: tenant.printFooterRu ?? null,
    printFooterAz: tenant.printFooterAz ?? null,
    printSignatureLab: tenant.printSignatureLab ?? null,
    printSignatureDoctor: tenant.printSignatureDoctor ?? null,
    checkupSectionsJson: tenant.checkupSectionsJson ?? null,
    doctorBonusPercentInHouse: tenant.doctorBonusPercentInHouse ?? 0,
    doctorBonusPercentWalkIn: tenant.doctorBonusPercentWalkIn ?? 0,
    hotelFolioRevenueCode: tenant.hotelFolioRevenueCode?.trim() || null,
    noShowKeepsCharge: tenant.noShowKeepsCharge !== false,
    extraProcedureRoute: parseExtraProcedureRoute(tenant.extraProcedureRoute),
    controlPlanePrint: await (async () => {
      const { resolveCpPrintLocks } = await import(
        "@/domain/print/cp-print-locks"
      );
      return resolveCpPrintLocks();
    })(),
  };
}

function clampHour(n: number | undefined, fallback: number): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

function clampWeekdays(values: number[] | undefined): number[] | undefined {
  if (!values) return undefined;
  const out = [...new Set(values.filter((d) => d >= 0 && d <= 6))];
  return out;
}

export async function updateClinicSettings(input: {
  clinicName?: string;
  enabledPresets?: string[];
  programSchedulingMode?: ProgramSchedulingMode;
  schedulingSlotMinutes?: number;
  defaultAppointmentSlotMinutes?: number;
  procedureOverQuotaPolicy?: ProcedureOverQuotaPolicy;
  procedureCheckInMode?: ProcedureCheckInMode;
  dayStartHour?: number;
  dayEndHour?: number;
  lunchStartHour?: number;
  lunchEndHour?: number;
  closedWeekdays?: number[];
  saturdayEndHour?: number;
  shortenedDayEndHour?: number;
  bathDayModes?: BathModeDef[];
  defaultBathMode?: string;
  closedDaySpendsOwedRest?: boolean;
  closedDayResetsOpenStreak?: boolean;
  weeklyNaftalanCap?: number;
  defaultProcedureGapMinutes?: number;
  peakModeEnabled?: boolean;
  peakDayEndHour?: number;
  checkInRequiresQr?: boolean;
  procedureCheckInWindow?: "STRICT" | "SAME_DAY";
  procedureCheckInSameDayUntil?: string | null;
  receptionProcedureCheckIn?: boolean;
  autoNoShowAfterMin?: number | null;
  patientCardResultsPreview?: number;
  patientCardPlanPreview?: number;
  patientCardHistoryPageSize?: number;
  patientCardPlanPageSize?: number;
  printLogoDataUrl?: string | null;
  printClinicNameEn?: string | null;
  printClinicNameRu?: string | null;
  printClinicNameAz?: string | null;
  printAddressEn?: string | null;
  printAddressRu?: string | null;
  printAddressAz?: string | null;
  printPhone?: string | null;
  printEmail?: string | null;
  printWebsite?: string | null;
  printFooterEn?: string | null;
  printFooterRu?: string | null;
  printFooterAz?: string | null;
  printSignatureLab?: string | null;
  printSignatureDoctor?: string | null;
  checkupSectionsJson?: string | null;
  doctorBonusPercentInHouse?: number;
  doctorBonusPercentWalkIn?: number;
  hotelFolioRevenueCode?: string | null;
  noShowKeepsCharge?: boolean;
  extraProcedureRoute?: string | null;
}) {
  // CP-ORG-PROFILE-01 Track A: ignore header branding writes when orch snapshot is cached.
  const cpLocks = await (async () => {
    const { resolveCpPrintLocks } = await import("@/domain/print/cp-print-locks");
    return resolveCpPrintLocks();
  })();
  if (cpLocks.active) {
    if (cpLocks.logo) delete input.printLogoDataUrl;
    if (cpLocks.address) {
      delete input.printAddressEn;
      delete input.printAddressRu;
      delete input.printAddressAz;
    }
    if (cpLocks.phone) delete input.printPhone;
    if (cpLocks.email) delete input.printEmail;
    if (cpLocks.website) delete input.printWebsite;
  }

  const presets = input.enabledPresets?.filter(isClinicPreset) ?? undefined;
  if (input.enabledPresets && presets && presets.length !== input.enabledPresets.length) {
    throw new Error("Invalid preset code");
  }
  if (presets && presets.length === 0) {
    throw new Error("At least one preset required");
  }

  const resultsPreview = clampCardLimit(
    input.patientCardResultsPreview,
    CARD_DEFAULTS.patientCardResultsPreview,
  );
  const planPreview = clampCardLimit(
    input.patientCardPlanPreview,
    CARD_DEFAULTS.patientCardPlanPreview,
  );
  const historyPage = clampCardLimit(
    input.patientCardHistoryPageSize,
    CARD_DEFAULTS.patientCardHistoryPageSize,
  );
  const planPage = clampCardLimit(
    input.patientCardPlanPageSize,
    CARD_DEFAULTS.patientCardPlanPageSize,
  );
  const dayStartHour = clampHour(input.dayStartHour, 9);
  const dayEndHour = clampHour(input.dayEndHour, 18);
  const lunchStartHour = clampHour(input.lunchStartHour, 13);
  const lunchEndHour = clampHour(input.lunchEndHour, 14);
  const closedWeekdays = clampWeekdays(input.closedWeekdays);
  const saturdayEndHour = clampHour(input.saturdayEndHour, 13);
  const shortenedDayEndHour = clampHour(input.shortenedDayEndHour, 13);
  const bathDayModesJson =
    input.bathDayModes != null ? JSON.stringify(parseBathDayModes(input.bathDayModes)) : undefined;
  const defaultBathMode =
    input.defaultBathMode != null
      ? String(input.defaultBathMode).trim().toUpperCase().slice(0, 16) || "3"
      : undefined;
  const weeklyNaftalanCap =
    input.weeklyNaftalanCap != null
      ? Math.min(14, Math.max(0, Math.floor(input.weeklyNaftalanCap)))
      : undefined;
  const defaultProcedureGapMinutes =
    input.defaultProcedureGapMinutes != null
      ? Math.min(240, Math.max(0, Math.floor(input.defaultProcedureGapMinutes)))
      : undefined;
  const defaultAppointmentSlotMinutes =
    input.defaultAppointmentSlotMinutes != null
      ? Math.min(120, Math.max(5, Math.floor(input.defaultAppointmentSlotMinutes)))
      : undefined;

  return prisma.tenant.upsert({
    where: { code: DEFAULT_TENANT_CODE } as never,
    create: {
      code: DEFAULT_TENANT_CODE,
      name: input.clinicName ?? "Nafta Clinic",
      enabledPresets: presets ?? [CLINIC_PRESET.OUTPATIENT],
      dayStartHour: dayStartHour ?? 9,
      dayEndHour: dayEndHour ?? 18,
      lunchStartHour: lunchStartHour ?? 13,
      lunchEndHour: lunchEndHour ?? 14,
      closedWeekdays: closedWeekdays ?? [0],
      saturdayEndHour: saturdayEndHour ?? 13,
      shortenedDayEndHour: shortenedDayEndHour ?? 13,
      ...(bathDayModesJson != null ? { bathDayModesJson } : {}),
      ...(defaultBathMode != null ? { defaultBathMode } : {}),
      ...(input.closedDaySpendsOwedRest != null
        ? { closedDaySpendsOwedRest: input.closedDaySpendsOwedRest }
        : {}),
      ...(input.closedDayResetsOpenStreak != null
        ? { closedDayResetsOpenStreak: input.closedDayResetsOpenStreak }
        : {}),
      ...(weeklyNaftalanCap != null ? { weeklyNaftalanCap } : {}),
      defaultProcedureGapMinutes: defaultProcedureGapMinutes ?? 5,
      ...(resultsPreview != null ? { patientCardResultsPreview: resultsPreview } : {}),
      ...(planPreview != null ? { patientCardPlanPreview: planPreview } : {}),
      ...(historyPage != null ? { patientCardHistoryPageSize: historyPage } : {}),
      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),
    },
    update: {
      ...(input.clinicName ? { name: input.clinicName } : {}),
      ...(presets ? { enabledPresets: presets } : {}),
      ...(input.programSchedulingMode
        ? { programSchedulingMode: input.programSchedulingMode }
        : {}),
      ...(input.schedulingSlotMinutes != null
        ? { schedulingSlotMinutes: input.schedulingSlotMinutes }
        : {}),
      ...(defaultAppointmentSlotMinutes != null
        ? { defaultAppointmentSlotMinutes }
        : {}),
      ...(input.procedureOverQuotaPolicy
        ? { procedureOverQuotaPolicy: input.procedureOverQuotaPolicy }
        : {}),
      ...(dayStartHour != null ? { dayStartHour } : {}),
      ...(dayEndHour != null ? { dayEndHour } : {}),
      ...(lunchStartHour != null ? { lunchStartHour } : {}),
      ...(lunchEndHour != null ? { lunchEndHour } : {}),
      ...(closedWeekdays != null ? { closedWeekdays } : {}),
      ...(saturdayEndHour != null ? { saturdayEndHour } : {}),
      ...(shortenedDayEndHour != null ? { shortenedDayEndHour } : {}),
      ...(bathDayModesJson != null ? { bathDayModesJson } : {}),
      ...(defaultBathMode != null ? { defaultBathMode } : {}),
      ...(input.closedDaySpendsOwedRest != null
        ? { closedDaySpendsOwedRest: input.closedDaySpendsOwedRest }
        : {}),
      ...(input.closedDayResetsOpenStreak != null
        ? { closedDayResetsOpenStreak: input.closedDayResetsOpenStreak }
        : {}),
      ...(weeklyNaftalanCap != null ? { weeklyNaftalanCap } : {}),
      ...(defaultProcedureGapMinutes != null ? { defaultProcedureGapMinutes } : {}),
      ...(input.peakModeEnabled != null ? { peakModeEnabled: input.peakModeEnabled } : {}),
      ...(input.peakDayEndHour != null
        ? { peakDayEndHour: Math.min(24, Math.max(1, Math.floor(input.peakDayEndHour))) }
        : {}),
      ...(input.procedureCheckInMode != null
        ? {
            procedureCheckInMode: input.procedureCheckInMode,
            checkInRequiresQr: input.procedureCheckInMode === "QR",
          }
        : {}),
      ...(input.procedureCheckInMode == null && input.checkInRequiresQr != null
        ? {
            checkInRequiresQr: input.checkInRequiresQr,
            procedureCheckInMode: input.checkInRequiresQr ? "QR" : "MANUAL",
          }
        : {}),
      ...(input.autoNoShowAfterMin !== undefined
        ? {
            autoNoShowAfterMin:
              input.autoNoShowAfterMin == null
                ? null
                : Math.min(24 * 60, Math.max(1, Math.floor(input.autoNoShowAfterMin))),
          }
        : {}),
      ...(input.procedureCheckInWindow != null
        ? { procedureCheckInWindow: input.procedureCheckInWindow }
        : {}),
      ...(input.procedureCheckInSameDayUntil !== undefined
        ? {
            procedureCheckInSameDayUntil:
              input.procedureCheckInSameDayUntil == null ||
              input.procedureCheckInSameDayUntil === ""
                ? null
                : new Date(input.procedureCheckInSameDayUntil),
          }
        : {}),
      ...(input.receptionProcedureCheckIn != null
        ? { receptionProcedureCheckIn: input.receptionProcedureCheckIn }
        : {}),
      ...(resultsPreview != null ? { patientCardResultsPreview: resultsPreview } : {}),
      ...(planPreview != null ? { patientCardPlanPreview: planPreview } : {}),
      ...(historyPage != null ? { patientCardHistoryPageSize: historyPage } : {}),
      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),
      ...(input.printLogoDataUrl !== undefined ? { printLogoDataUrl: input.printLogoDataUrl } : {}),
      ...(input.printClinicNameEn !== undefined ? { printClinicNameEn: input.printClinicNameEn } : {}),
      ...(input.printClinicNameRu !== undefined ? { printClinicNameRu: input.printClinicNameRu } : {}),
      ...(input.printClinicNameAz !== undefined ? { printClinicNameAz: input.printClinicNameAz } : {}),
      ...(input.printAddressEn !== undefined ? { printAddressEn: input.printAddressEn } : {}),
      ...(input.printAddressRu !== undefined ? { printAddressRu: input.printAddressRu } : {}),
      ...(input.printAddressAz !== undefined ? { printAddressAz: input.printAddressAz } : {}),
      ...(input.printPhone !== undefined ? { printPhone: input.printPhone } : {}),
      ...(input.printEmail !== undefined ? { printEmail: input.printEmail } : {}),
      ...(input.printWebsite !== undefined ? { printWebsite: input.printWebsite } : {}),
      ...(input.printFooterEn !== undefined ? { printFooterEn: input.printFooterEn } : {}),
      ...(input.printFooterRu !== undefined ? { printFooterRu: input.printFooterRu } : {}),
      ...(input.printFooterAz !== undefined ? { printFooterAz: input.printFooterAz } : {}),
      ...(input.printSignatureLab !== undefined ? { printSignatureLab: input.printSignatureLab } : {}),
      ...(input.printSignatureDoctor !== undefined
        ? { printSignatureDoctor: input.printSignatureDoctor }
        : {}),
      ...(input.checkupSectionsJson !== undefined
        ? { checkupSectionsJson: input.checkupSectionsJson }
        : {}),
      ...(input.doctorBonusPercentInHouse != null
        ? {
            doctorBonusPercentInHouse: Math.min(
              100,
              Math.max(0, Number(input.doctorBonusPercentInHouse)),
            ),
          }
        : {}),
      ...(input.doctorBonusPercentWalkIn != null
        ? {
            doctorBonusPercentWalkIn: Math.min(
              100,
              Math.max(0, Number(input.doctorBonusPercentWalkIn)),
            ),
          }
        : {}),
      ...(input.hotelFolioRevenueCode !== undefined
        ? { hotelFolioRevenueCode: input.hotelFolioRevenueCode?.trim() || null }
        : {}),
      ...(input.noShowKeepsCharge !== undefined
        ? { noShowKeepsCharge: input.noShowKeepsCharge }
        : {}),
      ...(input.extraProcedureRoute
        ? { extraProcedureRoute: parseExtraProcedureRoute(input.extraProcedureRoute) }
        : {}),
    },
  });
}

export async function getEnabledPresets(): Promise<ClinicPresetCode[]> {
  const tenant = await getDefaultTenant();
  const raw = tenant.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT];
  return raw.filter(isClinicPreset);
}

export async function hasPreset(preset: ClinicPresetCode): Promise<boolean> {
  const enabled = await getEnabledPresets();
  return enabled.includes(preset);
}

export function normalizePresets(values: string[]): ClinicPresetCode[] {
  const out: ClinicPresetCode[] = [];
  for (const v of values) {
    if (isClinicPreset(v) && !out.includes(v)) out.push(v);
  }
  return out.length > 0 ? out : [CLINIC_PRESET.OUTPATIENT];
}

export { ALL_CLINIC_PRESETS, CARD_DEFAULTS };
