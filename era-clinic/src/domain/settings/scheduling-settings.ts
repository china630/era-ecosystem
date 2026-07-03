import type {
  ProcedureOverQuotaPolicy,
  ProgramSchedulingMode,
} from "@prisma/client";
import { getDefaultTenant } from "@/domain/settings/settings.service";

export type SchedulingSettings = {
  programSchedulingMode: ProgramSchedulingMode;
  schedulingSlotMinutes: number;
  procedureOverQuotaPolicy: ProcedureOverQuotaPolicy;
};

export const SANATORIUM_DEFAULT_SETTINGS: SchedulingSettings = {
  programSchedulingMode: "AFTER_CHECKUP",
  schedulingSlotMinutes: 5,
  procedureOverQuotaPolicy: "CHARGE_FOLIO",
};

export async function getSchedulingSettings(): Promise<SchedulingSettings> {
  const tenant = await getDefaultTenant();
  return {
    programSchedulingMode: tenant.programSchedulingMode,
    schedulingSlotMinutes: tenant.schedulingSlotMinutes,
    procedureOverQuotaPolicy: tenant.procedureOverQuotaPolicy,
  };
}

export async function shouldAutoInstantiateProgramOnCheckin(): Promise<boolean> {
  const settings = await getSchedulingSettings();
  return settings.programSchedulingMode === "ON_CHECKIN";
}
