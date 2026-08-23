import type {
  GenderSessionMode,
  GenderSessionPolicy,
  GenderSessionUnknownPolicy,
  PatientSex,
} from "@prisma/client";

export type GenderHourWindow = { startHour: number; endHour: number };

export type ResolvedGenderSession = {
  active: boolean;
  femaleFirst: boolean;
  unknown: GenderSessionUnknownPolicy;
  female: GenderHourWindow;
  male: GenderHourWindow;
};

export type GenderSessionTenantInput = {
  genderSessionMode: GenderSessionMode;
  genderSessionFemaleFirst: boolean;
  genderSessionUnknown: GenderSessionUnknownPolicy;
  genderSessionFemaleStartHour?: number | null;
  genderSessionFemaleEndHour?: number | null;
  genderSessionMaleStartHour?: number | null;
  genderSessionMaleEndHour?: number | null;
  dayStartHour: number;
  dayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
};

export type GenderSessionTypeInput = {
  genderSessionPolicy: GenderSessionPolicy;
  genderSessionFemaleStartHour?: number | null;
  genderSessionFemaleEndHour?: number | null;
  genderSessionMaleStartHour?: number | null;
  genderSessionMaleEndHour?: number | null;
  dayStartHour?: number | null;
  dayEndHour?: number | null;
};

function splitByLunch(tenant: GenderSessionTenantInput, type?: GenderSessionTypeInput): {
  female: GenderHourWindow;
  male: GenderHourWindow;
} {
  const dayStart = type?.dayStartHour ?? tenant.dayStartHour;
  const dayEnd = type?.dayEndHour ?? tenant.dayEndHour;
  const am: GenderHourWindow = { startHour: dayStart, endHour: tenant.lunchStartHour };
  const pm: GenderHourWindow = { startHour: tenant.lunchEndHour, endHour: dayEnd };
  if (tenant.genderSessionFemaleFirst) {
    return { female: am, male: pm };
  }
  return { female: pm, male: am };
}

function customWindows(
  tenant: GenderSessionTenantInput,
  type?: GenderSessionTypeInput,
): { female: GenderHourWindow; male: GenderHourWindow } {
  const fallback = splitByLunch(tenant, type);
  return {
    female: {
      startHour: type?.genderSessionFemaleStartHour ?? tenant.genderSessionFemaleStartHour ?? fallback.female.startHour,
      endHour: type?.genderSessionFemaleEndHour ?? tenant.genderSessionFemaleEndHour ?? fallback.female.endHour,
    },
    male: {
      startHour: type?.genderSessionMaleStartHour ?? tenant.genderSessionMaleStartHour ?? fallback.male.startHour,
      endHour: type?.genderSessionMaleEndHour ?? tenant.genderSessionMaleEndHour ?? fallback.male.endHour,
    },
  };
}

export function resolveGenderSession(
  tenant: GenderSessionTenantInput,
  type: GenderSessionTypeInput,
): ResolvedGenderSession {
  let mode: GenderSessionMode | "OFF" = "OFF";
  if (type.genderSessionPolicy === "OFF") {
    mode = "OFF";
  } else if (type.genderSessionPolicy === "INHERIT") {
    mode = tenant.genderSessionMode;
  } else if (type.genderSessionPolicy === "SPLIT_BY_LUNCH") {
    mode = "SPLIT_BY_LUNCH";
  } else {
    mode = "CUSTOM_WINDOWS";
  }

  const windows =
    mode === "CUSTOM_WINDOWS" ? customWindows(tenant, type) : splitByLunch(tenant, type);

  return {
    active: mode !== "OFF",
    femaleFirst: tenant.genderSessionFemaleFirst,
    unknown: tenant.genderSessionUnknown,
    female: windows.female,
    male: windows.male,
  };
}

function hourOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function occupancyInsideWindow(startsAt: Date, endsAt: Date, window: GenderHourWindow): boolean {
  const startH = hourOf(startsAt);
  const endH = hourOf(endsAt);
  return startH >= window.startHour && endH <= window.endHour + 1e-9;
}

export function occupancyFitsGenderWindow(input: {
  resolved: ResolvedGenderSession;
  sex: PatientSex | null | undefined;
  startsAt: Date;
  endsAt: Date;
}): boolean {
  const { resolved, sex, startsAt, endsAt } = input;
  if (!resolved.active) return true;
  if (sex !== "MALE" && sex !== "FEMALE") {
    return resolved.unknown === "ALLOW_BOTH";
  }
  const window = sex === "FEMALE" ? resolved.female : resolved.male;
  return occupancyInsideWindow(startsAt, endsAt, window);
}

export function genderTintForHour(
  resolved: ResolvedGenderSession,
  hour: number,
): "female" | "male" | null {
  if (!resolved.active) return null;
  if (hour >= resolved.female.startHour && hour < resolved.female.endHour) return "female";
  if (hour >= resolved.male.startHour && hour < resolved.male.endHour) return "male";
  return null;
}

export function genderTenantFromPrisma(t: GenderSessionTenantInput): GenderSessionTenantInput {
  return {
    genderSessionMode: t.genderSessionMode,
    genderSessionFemaleFirst: t.genderSessionFemaleFirst,
    genderSessionUnknown: t.genderSessionUnknown,
    genderSessionFemaleStartHour: t.genderSessionFemaleStartHour,
    genderSessionFemaleEndHour: t.genderSessionFemaleEndHour,
    genderSessionMaleStartHour: t.genderSessionMaleStartHour,
    genderSessionMaleEndHour: t.genderSessionMaleEndHour,
    dayStartHour: t.dayStartHour,
    dayEndHour: t.dayEndHour,
    lunchStartHour: t.lunchStartHour,
    lunchEndHour: t.lunchEndHour,
  };
}
