export type ShiftType = {
  id: string;
  code: string;
  name: string;
  startMinute: number;
  endMinute: number;
  defaultHours: string | number;
  isNight: boolean;
};

export type CycleSlot = {
  slotIndex: number;
  shiftTypeId: string | null;
  shiftType?: { code: string; name: string } | null;
};

export type Cycle = {
  id: string;
  code: string;
  name: string;
  cycleAnchor: string;
  slots: CycleSlot[];
};

export type BrigadeMember = {
  id?: string;
  employmentId: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  staffCode?: string | null;
  globalPersonId?: string | null;
};

export type Brigade = {
  id: string;
  code: string;
  name: string;
  asOf?: string;
  members?: BrigadeMember[];
  _count?: { members: number };
};

export type BrigadeMembershipRow = {
  id: string;
  employmentId: string;
  staffCode: string | null;
  globalPersonId: string | null;
  brigade: { id: string; code: string; name: string };
  leftToBrigade: { id: string; code: string; name: string } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type Employment = {
  id: string;
  staffCode: string | null;
  globalPersonId?: string;
};

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function cycleTape(slots: CycleSlot[]): string {
  return slots
    .map((s) => (s.shiftTypeId ? s.shiftType?.code ?? "?" : "OFF"))
    .join(" · ");
}
