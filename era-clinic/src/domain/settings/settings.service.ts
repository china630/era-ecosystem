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
  };
}

export async function updateClinicSettings(input: {
  clinicName?: string;
  enabledPresets?: string[];
  programSchedulingMode?: ProgramSchedulingMode;
  schedulingSlotMinutes?: number;
  procedureOverQuotaPolicy?: ProcedureOverQuotaPolicy;
}) {
  const presets = input.enabledPresets?.filter(isClinicPreset) ?? undefined;
  if (input.enabledPresets && presets && presets.length !== input.enabledPresets.length) {
    throw new Error("Invalid preset code");
  }
  if (presets && presets.length === 0) {
    throw new Error("At least one preset required");
  }

  return prisma.tenant.upsert({
    where: { code: DEFAULT_TENANT_CODE },
    create: {
      code: DEFAULT_TENANT_CODE,
      name: input.clinicName ?? "Nafta Clinic",
      enabledPresets: presets ?? [CLINIC_PRESET.OUTPATIENT],
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

export { ALL_CLINIC_PRESETS };
