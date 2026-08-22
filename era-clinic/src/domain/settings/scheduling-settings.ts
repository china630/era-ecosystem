import type {
  ProcedureOverQuotaPolicy,
  ProgramSchedulingMode,
} from "@prisma/client";
import { getDefaultTenant } from "@/domain/settings/settings.service";

export type SchedulingSettings = {
  programSchedulingMode: ProgramSchedulingMode;
  schedulingSlotMinutes: number;
  /// Default appointment slot length for new practitioners (outpatient doctor matrix).
  defaultAppointmentSlotMinutes: number;
  procedureOverQuotaPolicy: ProcedureOverQuotaPolicy;
  dayStartHour: number;
  dayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
  closedWeekdays: number[];
  defaultProcedureGapMinutes: number;
  peakModeEnabled: boolean;
  peakDayEndHour: number;
};

export type TenantWorkHours = Pick<
  SchedulingSettings,
  | "dayStartHour"
  | "dayEndHour"
  | "lunchStartHour"
  | "lunchEndHour"
  | "closedWeekdays"
  | "peakModeEnabled"
  | "peakDayEndHour"
>;

export const SANATORIUM_DEFAULT_SETTINGS: SchedulingSettings = {
  programSchedulingMode: "AFTER_CHECKUP",
  schedulingSlotMinutes: 5,
  defaultAppointmentSlotMinutes: 30,
  procedureOverQuotaPolicy: "CHARGE_FOLIO",
  dayStartHour: 9,
  dayEndHour: 17,
  lunchStartHour: 13,
  lunchEndHour: 14,
  closedWeekdays: [0],
  defaultProcedureGapMinutes: 5,
  peakModeEnabled: false,
  peakDayEndHour: 22,
};

export const DEFAULT_WORK_HOURS: TenantWorkHours = {
  dayStartHour: 9,
  dayEndHour: 17,
  lunchStartHour: 13,
  lunchEndHour: 14,
  closedWeekdays: [0],
  peakModeEnabled: false,
  peakDayEndHour: 22,
};

function workHoursFromTenant(tenant: Awaited<ReturnType<typeof getDefaultTenant>>): TenantWorkHours {
  return {
    dayStartHour: tenant.dayStartHour,
    dayEndHour: tenant.dayEndHour,
    lunchStartHour: tenant.lunchStartHour,
    lunchEndHour: tenant.lunchEndHour,
    closedWeekdays: tenant.closedWeekdays ?? [0],
    peakModeEnabled: tenant.peakModeEnabled ?? false,
    peakDayEndHour: tenant.peakDayEndHour ?? 22,
  };
}

export async function getSchedulingSettings(): Promise<SchedulingSettings> {
  const tenant = await getDefaultTenant();
  return {
    programSchedulingMode: tenant.programSchedulingMode,
    schedulingSlotMinutes: tenant.schedulingSlotMinutes,
    defaultAppointmentSlotMinutes: tenant.defaultAppointmentSlotMinutes ?? 30,
    procedureOverQuotaPolicy: tenant.procedureOverQuotaPolicy,
    defaultProcedureGapMinutes: tenant.defaultProcedureGapMinutes ?? 5,
    ...workHoursFromTenant(tenant),
  };
}

/**
 * Effective day end for a procedure/resource under peak mode.
 * Without peak mode, always tenant dayEndHour.
 */
export function resolveEffectiveDayEndHour(
  hours: TenantWorkHours,
  opts?: { procedureExtendedEndHour?: number | null; resourceExtendedEndHour?: number | null },
): number {
  if (!hours.peakModeEnabled) return hours.dayEndHour;
  const overrides = [
    opts?.procedureExtendedEndHour,
    opts?.resourceExtendedEndHour,
    hours.peakDayEndHour,
  ].filter((v): v is number => typeof v === "number" && v > 0);
  if (overrides.length === 0) return hours.dayEndHour;
  return Math.max(hours.dayEndHour, ...overrides);
}

export async function getTenantWorkHours(): Promise<TenantWorkHours> {
  const tenant = await getDefaultTenant();
  return workHoursFromTenant(tenant);
}

export async function shouldAutoInstantiateProgramOnCheckin(): Promise<boolean> {
  const settings = await getSchedulingSettings();
  return settings.programSchedulingMode === "ON_CHECKIN";
}

export function weekdayFromCalendarDate(date: Date): number {
  return date.getDay();
}

export function isClosedWeekday(date: Date, closedWeekdays: number[]): boolean {
  return closedWeekdays.includes(weekdayFromCalendarDate(date));
}

/**
 * Round duration UP to the scheduling slot grid so procedure ends land on
 * :00 / :05 / :10 / … when starts are slot-aligned.
 */
export function alignDurationToSlotMinutes(
  durationMin: number,
  slotMinutes: number = SANATORIUM_DEFAULT_SETTINGS.schedulingSlotMinutes,
): number {
  const slot = Math.max(1, Math.floor(slotMinutes));
  const raw = Math.max(1, Math.floor(Number(durationMin) || 0));
  return Math.ceil(raw / slot) * slot;
}

export function isDurationAlignedToSlot(
  durationMin: number,
  slotMinutes: number = SANATORIUM_DEFAULT_SETTINGS.schedulingSlotMinutes,
): boolean {
  const slot = Math.max(1, Math.floor(slotMinutes));
  return Number.isInteger(durationMin) && durationMin > 0 && durationMin % slot === 0;
}
