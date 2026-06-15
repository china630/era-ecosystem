import { prisma } from "@/lib/prisma";
import {
  ALL_CLINIC_PRESETS,
  CLINIC_PRESET,
  isClinicPreset,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";

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
  };
}

export async function updateClinicSettings(input: {
  clinicName?: string;
  enabledPresets?: string[];
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
