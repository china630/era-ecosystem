/**
 * Department duty schedule type catalog.
 * ADR: docs/adr/hotel-department-duty-schedules.md
 * Algorithms stay per type — this is metadata, not one engine.
 */

export const DUTY_SCHEDULE_TYPES = {
  WEEK_ZONE: {
    code: "WEEK_ZONE" as const,
    period: "week",
    axis: "zone",
    cellCodes: ["E", "L", "N", "OFF", "EG"] as const,
    conflict: "none" as const,
    note: "Housekeeping — existing HkRosterWeek; do not rewrite cells here",
  },
  WEEK_POST: {
    code: "WEEK_POST" as const,
    period: "week",
    axis: "post",
    cellCodes: ["E", "L", "N", "OFF", "EG"] as const,
    conflict: "one_person_one_post_per_day" as const,
    note: "Reception / security — post x day; one person cannot cover two posts same day",
  },
  WEEK_CREW: {
    code: "WEEK_CREW" as const,
    period: "week",
    axis: "crew_zone",
    cellCodes: ["E", "L", "N", "OFF", "DUTY", "EG"] as const,
    conflict: "one_person_one_zone_per_day" as const,
    note: "Engineering — brigade/zone x day; does not replace work orders",
  },
  WEEK_PERSON: {
    code: "WEEK_PERSON" as const,
    period: "week",
    axis: "person",
    cellCodes: ["E", "A", "L", "P", "N", "OFF", "EG", "IB"] as const,
    conflict: "one_cell_per_person_day" as const,
    note: "F&B cədvəl lives in era-fnb-pos; hotel catalog lists the type only",
  },
  MONTH_DUTY: {
    code: "MONTH_DUTY" as const,
    period: "month",
    axis: "procedure",
    cellCodes: [] as const,
    conflict: "clinic_only" as const,
    note: "Clinic StaffDutyRoster — hotel must not execute or write this type",
  },
} as const;

export type DutyScheduleTypeCode = keyof typeof DUTY_SCHEDULE_TYPES;

export const HOTEL_DUTY_DEPTS = ["RECEPTION", "SECURITY", "ENGINEERING"] as const;
export type HotelDutyDept = (typeof HOTEL_DUTY_DEPTS)[number];

export const DEPT_DEFAULT_TYPE: Record<HotelDutyDept, DutyScheduleTypeCode> = {
  RECEPTION: "WEEK_POST",
  SECURITY: "WEEK_POST",
  ENGINEERING: "WEEK_CREW",
};

export const DEPT_DEFAULT_AXES: Record<
  HotelDutyDept,
  Array<{ code: string; name: string; kind: string }>
> = {
  RECEPTION: [
    { code: "FRONT_DESK", name: "Front desk", kind: "POST" },
    { code: "NIGHT_DESK", name: "Night desk", kind: "POST" },
  ],
  SECURITY: [
    { code: "MAIN_GATE", name: "Main gate", kind: "POST" },
    { code: "PATROL", name: "Patrol", kind: "POST" },
  ],
  ENGINEERING: [
    { code: "MAIN_BUILDING", name: "Main building", kind: "CREW_ZONE" },
    { code: "ON_CALL", name: "On-call duty", kind: "CREW_ZONE" },
  ],
};

/** Default shift codes for hotel WEEK_POST / WEEK_CREW boards. */
export const DEFAULT_HOTEL_SHIFT_CODES: Array<{
  code: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
}> = [
  { code: "E", label: "Early", startTime: "08:00", endTime: "16:00", sortOrder: 10 },
  { code: "L", label: "Late", startTime: "16:00", endTime: "00:00", sortOrder: 20 },
  { code: "N", label: "Night", startTime: "00:00", endTime: "08:00", sortOrder: 30 },
  { code: "OFF", label: "Day off", startTime: null, endTime: null, sortOrder: 40 },
  { code: "EG", label: "Compensatory day (ƏG)", startTime: null, endTime: null, sortOrder: 50 },
  { code: "DUTY", label: "Duty / on-call", startTime: null, endTime: null, sortOrder: 60 },
];

export function isHotelDutyDept(value: string): value is HotelDutyDept {
  return (HOTEL_DUTY_DEPTS as readonly string[]).includes(value);
}

export function allowedCodesForDept(dept: HotelDutyDept): readonly string[] {
  const type = DEPT_DEFAULT_TYPE[dept];
  return DUTY_SCHEDULE_TYPES[type].cellCodes;
}
