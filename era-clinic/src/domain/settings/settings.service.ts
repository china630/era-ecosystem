import { prisma } from "@/lib/prisma";
import {
  ALL_CLINIC_PRESETS,
  CLINIC_PRESET,
  isClinicPreset,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";
import { SANATORIUM_DEFAULT_SETTINGS } from "@/domain/settings/scheduling-settings";
import type {
  ProcedureOverQuotaPolicy,
  ProgramSchedulingMode,
} from "@prisma/client";

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
  let tenant = await prisma.tenant.findUnique({
    where: { code: DEFAULT_TENANT_CODE },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        code: DEFAULT_TENANT_CODE,
        name: "Nafta Clinic",
        enabledPresets: [CLINIC_PRESET.OUTPATIENT, CLINIC_PRESET.SANATORIUM_CLINICAL],
        programSchedulingMode: SANATORIUM_DEFAULT_SETTINGS.programSchedulingMode,
        schedulingSlotMinutes: SANATORIUM_DEFAULT_SETTINGS.schedulingSlotMinutes,
        procedureOverQuotaPolicy: SANATORIUM_DEFAULT_SETTINGS.procedureOverQuotaPolicy,
      },
    });
  }
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
    procedureOverQuotaPolicy: tenant.procedureOverQuotaPolicy,
    patientCardResultsPreview:
      tenant.patientCardResultsPreview ?? CARD_DEFAULTS.patientCardResultsPreview,
    patientCardPlanPreview: tenant.patientCardPlanPreview ?? CARD_DEFAULTS.patientCardPlanPreview,
    patientCardHistoryPageSize:
      tenant.patientCardHistoryPageSize ?? CARD_DEFAULTS.patientCardHistoryPageSize,
    patientCardPlanPageSize:
      tenant.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,
  };
}

export async function updateClinicSettings(input: {
  clinicName?: string;
  enabledPresets?: string[];
  programSchedulingMode?: ProgramSchedulingMode;
  schedulingSlotMinutes?: number;
  procedureOverQuotaPolicy?: ProcedureOverQuotaPolicy;
  patientCardResultsPreview?: number;
  patientCardPlanPreview?: number;
  patientCardHistoryPageSize?: number;
  patientCardPlanPageSize?: number;
}) {
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

  return prisma.tenant.upsert({
    where: { code: DEFAULT_TENANT_CODE },
    create: {
      code: DEFAULT_TENANT_CODE,
      name: input.clinicName ?? "Nafta Clinic",
      enabledPresets: presets ?? [CLINIC_PRESET.OUTPATIENT],
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
      ...(input.procedureOverQuotaPolicy
        ? { procedureOverQuotaPolicy: input.procedureOverQuotaPolicy }
        : {}),
      ...(resultsPreview != null ? { patientCardResultsPreview: resultsPreview } : {}),
      ...(planPreview != null ? { patientCardPlanPreview: planPreview } : {}),
      ...(historyPage != null ? { patientCardHistoryPageSize: historyPage } : {}),
      ...(planPage != null ? { patientCardPlanPageSize: planPage } : {}),
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
