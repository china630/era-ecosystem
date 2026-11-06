/**
 * Clinic day boundary + peak journal → procedure bookable window.
 * Pure: no DB. Callers preload days, peaks, and procedure hours once per seat call.
 */

export type ClinicDayKind = "working" | "short" | "closed";

export type PeakDayKind = "WORKING" | "SHORT";
export type PeakScope = "OWN_ONLY" | "EMPTY_DEFAULT" | "CLINIC_WIDE";

export type DayBoundary = {
  ymd: string;
  kind: ClinicDayKind;
  /** Inclusive Asia/Baku wall-clock start hour. */
  startHour: number;
  /** Exclusive Asia/Baku wall-clock end hour. */
  endHour: number;
};

export type PeakRule = {
  id?: string;
  fromYmd: string;
  toYmd: string;
  dayKind: PeakDayKind;
  scope: PeakScope;
  startHour: number | null;
  endHour: number | null;
};

export type ProcedurePeakHours = {
  extendedStartHour?: number | null;
  extendedEndHour?: number | null;
};

export type ProcedureDayWindow = {
  ymd: string;
  closed: boolean;
  dayKind: ClinicDayKind;
  /** Clinic boundary before peak (for grid darkening). */
  clinicStartHour: number;
  clinicEndHour: number;
  /** Bookable window for this procedure. */
  startHour: number;
  endHour: number;
};

export function peakKindForDay(kind: ClinicDayKind): PeakDayKind | null {
  if (kind === "working") return "WORKING";
  if (kind === "short") return "SHORT";
  return null;
}

/** Inclusive civil-date ranges overlap. */
export function peakDateRangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Two rules of the same day kind with overlapping dates cannot both be saved.
 * Returns the first conflicting pair, or null.
 */
export function findPeakOverlap(
  rules: PeakRule[],
  candidate: PeakRule,
  excludeId?: string,
): PeakRule | null {
  for (const row of rules) {
    if (excludeId && row.id === excludeId) continue;
    if (row.dayKind !== candidate.dayKind) continue;
    if (peakDateRangesOverlap(row.fromYmd, row.toYmd, candidate.fromYmd, candidate.toYmd)) {
      return row;
    }
  }
  return null;
}

export function pickPeakRule(
  ymd: string,
  dayKind: ClinicDayKind,
  peaks: PeakRule[],
): PeakRule | null {
  const want = peakKindForDay(dayKind);
  if (!want) return null;
  for (const row of peaks) {
    if (row.dayKind !== want) continue;
    if (row.fromYmd <= ymd && ymd <= row.toYmd) return row;
  }
  return null;
}

/**
 * Legacy bridge: peakModeEnabled with no covering journal row acts as OWN_ONLY
 * on working days only (short days stay on the short boundary).
 */
export function resolveActivePeak(input: {
  ymd: string;
  dayKind: ClinicDayKind;
  peaks: PeakRule[];
  peakModeEnabled?: boolean;
}): PeakRule | null {
  const covering = pickPeakRule(input.ymd, input.dayKind, input.peaks);
  if (covering) return covering;
  if (input.peakModeEnabled && input.dayKind === "working") {
    return {
      fromYmd: input.ymd,
      toYmd: input.ymd,
      dayKind: "WORKING",
      scope: "OWN_ONLY",
      startHour: null,
      endHour: null,
    };
  }
  return null;
}

function expandStart(clinicStart: number, candidate: number | null | undefined): number {
  if (candidate == null || !Number.isFinite(candidate)) return clinicStart;
  return Math.min(clinicStart, Math.floor(candidate));
}

function expandEnd(clinicEnd: number, candidate: number | null | undefined): number {
  if (candidate == null || !Number.isFinite(candidate)) return clinicEnd;
  return Math.max(clinicEnd, Math.floor(candidate));
}

/**
 * Bookable window for one procedure on one day.
 * Peak may only start earlier or end later than the clinic boundary.
 * Closed days stay closed. Card hours alone do not open a closed day.
 */
export function resolveProcedureDayWindow(input: {
  day: DayBoundary;
  peaks: PeakRule[];
  procedure: ProcedurePeakHours;
  /** Optional resource card hour, merged as own peak with the procedure card. */
  resource?: ProcedurePeakHours | null;
  peakModeEnabled?: boolean;
}): ProcedureDayWindow {
  const { day } = input;
  const base: ProcedureDayWindow = {
    ymd: day.ymd,
    closed: day.kind === "closed",
    dayKind: day.kind,
    clinicStartHour: day.startHour,
    clinicEndHour: day.endHour,
    startHour: day.startHour,
    endHour: day.endHour,
  };
  if (day.kind === "closed" || day.endHour <= day.startHour) {
    return { ...base, closed: true, startHour: 0, endHour: 0 };
  }

  const ownStart =
    input.procedure.extendedStartHour ?? input.resource?.extendedStartHour ?? null;
  const ownEnd = input.procedure.extendedEndHour ?? input.resource?.extendedEndHour ?? null;

  const peak = resolveActivePeak({
    ymd: day.ymd,
    dayKind: day.kind,
    peaks: input.peaks,
    peakModeEnabled: input.peakModeEnabled,
  });
  if (!peak) return base;

  let start = day.startHour;
  let end = day.endHour;

  if (peak.scope === "OWN_ONLY") {
    start = expandStart(start, ownStart);
    end = expandEnd(end, ownEnd);
  } else if (peak.scope === "EMPTY_DEFAULT") {
    start = expandStart(start, ownStart != null ? ownStart : peak.startHour);
    end = expandEnd(end, ownEnd != null ? ownEnd : peak.endHour);
  } else {
    start = expandStart(start, peak.startHour);
    end = expandEnd(end, peak.endHour);
  }

  return { ...base, startHour: start, endHour: end };
}

/** Shared matrix axis for one day: earliest start … latest end across procedures. */
export function resolveGridAxis(
  day: DayBoundary,
  windows: ProcedureDayWindow[],
): { startHour: number; endHour: number } {
  if (day.kind === "closed") return { startHour: 0, endHour: 0 };
  let start = day.startHour;
  let end = day.endHour;
  for (const w of windows) {
    if (w.closed) continue;
    start = Math.min(start, w.startHour);
    end = Math.max(end, w.endHour);
  }
  return { startHour: start, endHour: end };
}

/** True when the hour is outside this procedure/resource bookable window (darken like lunch). */
export function hourOutsideProcedureWindow(
  hour: number,
  window: ProcedureDayWindow,
): boolean {
  if (window.closed) return true;
  return hour < window.startHour || hour >= window.endHour;
}

/**
 * Build per-ymd windows for one procedure across a stay.
 * O(days × 1) after peaks are loaded — safe to call once per seat invocation.
 */
export function mapProcedureWindows(input: {
  days: DayBoundary[];
  peaks: PeakRule[];
  procedure: ProcedurePeakHours;
  resource?: ProcedurePeakHours | null;
  peakModeEnabled?: boolean;
}): Map<string, ProcedureDayWindow> {
  const out = new Map<string, ProcedureDayWindow>();
  for (const day of input.days) {
    out.set(
      day.ymd,
      resolveProcedureDayWindow({
        day,
        peaks: input.peaks,
        procedure: input.procedure,
        resource: input.resource,
        peakModeEnabled: input.peakModeEnabled,
      }),
    );
  }
  return out;
}
