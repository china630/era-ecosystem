import type {
  DutyScheduleDept,
  DutyScheduleTypeCode,
  DutyScheduleWeekStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  DEPT_DEFAULT_AXES,
  DEPT_DEFAULT_TYPE,
  DEFAULT_HOTEL_SHIFT_CODES,
  DUTY_SCHEDULE_TYPES,
  allowedCodesForDept,
  isHotelDutyDept,
  type HotelDutyDept,
} from "./catalog";
import {
  fetchWorkforcePicker,
  filterPickerByBinding,
  type WorkforcePickerItem,
} from "./picker";
import { shiftYmd } from "./week-math";

export { shiftYmd };

export class DutyScheduleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DutyScheduleError";
  }
}

function orgId() {
  return requestOrganizationId();
}

function weekDate(weekStart: string) {
  return new Date(`${weekStart.slice(0, 10)}T00:00:00.000Z`);
}

function dayKey(d: Date | string) {
  return String(d).slice(0, 10);
}

export async function ensureDeptDefaults(dept: HotelDutyDept) {
  const organizationId = orgId();
  const typeCode = DEPT_DEFAULT_TYPE[dept] as DutyScheduleTypeCode;

  await prisma.dutyScheduleBinding.upsert({
    where: { organizationId_dept: { organizationId, dept } },
    create: {
      organizationId,
      dept,
      typeCode,
      orgUnitIds: [],
      positionIds: [],
    },
    update: {},
  });

  for (const [i, axis] of DEPT_DEFAULT_AXES[dept].entries()) {
    await prisma.dutyScheduleAxis.upsert({
      where: {
        organizationId_dept_code: { organizationId, dept, code: axis.code },
      },
      create: {
        organizationId,
        dept,
        code: axis.code,
        name: axis.name,
        kind: axis.kind,
        sortOrder: (i + 1) * 10,
        active: true,
      },
      update: {},
    });
  }

  for (const row of DEFAULT_HOTEL_SHIFT_CODES) {
    await prisma.dutyShiftCode.upsert({
      where: {
        organizationId_code: { organizationId, code: row.code },
      },
      create: {
        organizationId,
        code: row.code,
        label: row.label,
        startTime: row.startTime,
        endTime: row.endTime,
        sortOrder: row.sortOrder,
        active: true,
      },
      update: {},
    });
  }
}

export async function listCatalog() {
  return {
    types: Object.values(DUTY_SCHEDULE_TYPES),
    depts: (["HOUSEKEEPING", "RECEPTION", "SECURITY", "ENGINEERING"] as const).map(
      (dept) => ({
        dept,
        typeCode:
          dept === "HOUSEKEEPING"
            ? "WEEK_ZONE"
            : isHotelDutyDept(dept)
              ? DEPT_DEFAULT_TYPE[dept]
              : "WEEK_ZONE",
        href:
          dept === "HOUSEKEEPING"
            ? "/hk/roster"
            : `/schedules/${dept.toLowerCase()}`,
        implementedInHotel: dept !== "HOUSEKEEPING",
        note:
          dept === "HOUSEKEEPING"
            ? "Existing HK roster — WEEK_ZONE cells stay on HkRosterWeek"
            : undefined,
      }),
    ),
  };
}

export async function getBinding(dept: HotelDutyDept) {
  await ensureDeptDefaults(dept);
  return prisma.dutyScheduleBinding.findUniqueOrThrow({
    where: { organizationId_dept: { organizationId: orgId(), dept } },
  });
}

export async function upsertBinding(
  dept: HotelDutyDept,
  input: { orgUnitIds?: string[]; positionIds?: string[] },
) {
  await ensureDeptDefaults(dept);
  return prisma.dutyScheduleBinding.update({
    where: { organizationId_dept: { organizationId: orgId(), dept } },
    data: {
      orgUnitIds: input.orgUnitIds ?? [],
      positionIds: input.positionIds ?? [],
    },
  });
}

export async function listAxes(dept: HotelDutyDept) {
  await ensureDeptDefaults(dept);
  return prisma.dutyScheduleAxis.findMany({
    where: { organizationId: orgId(), dept, active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function listShiftCodes(dept?: HotelDutyDept) {
  await ensureDeptDefaults(dept ?? "RECEPTION");
  const rows = await prisma.dutyShiftCode.findMany({
    where: { organizationId: orgId(), active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  if (!dept) return rows;
  const allowed = new Set(allowedCodesForDept(dept));
  return rows.filter((row) => allowed.has(row.code));
}

function orgUnitOptionsFromPicker(items: WorkforcePickerItem[]) {
  const map = new Map<string, string>();
  for (const p of items) {
    if (p.orgUnitId) map.set(p.orgUnitId, p.orgUnitName || p.orgUnitId);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function listPersonnel(
  dept: HotelDutyDept,
  selectedOrgUnitIds?: string[],
) {
  const binding = await getBinding(dept);
  const picker = await fetchWorkforcePicker(orgId());
  if (picker.unavailable) {
    return {
      items: [] as WorkforcePickerItem[],
      unavailable: true,
      binding,
      orgUnitOptions: [] as Array<{ value: string; label: string }>,
    };
  }
  const items = filterPickerByBinding(
    picker.items,
    binding,
    selectedOrgUnitIds,
  );
  return {
    items,
    unavailable: false,
    binding,
    /** Full picker units for binding MULTI — not filtered by current binding. */
    orgUnitOptions: orgUnitOptionsFromPicker(picker.items),
  };
}

export async function getOrCreateWeek(dept: HotelDutyDept, weekStart: string) {
  await ensureDeptDefaults(dept);
  const organizationId = orgId();
  const start = weekDate(weekStart);
  let week = await prisma.dutyScheduleWeek.findUnique({
    where: {
      organizationId_dept_weekStart: { organizationId, dept, weekStart: start },
    },
    include: {
      cells: { include: { axis: true }, orderBy: [{ workDate: "asc" }] },
    },
  });
  if (!week) {
    week = await prisma.dutyScheduleWeek.create({
      data: { organizationId, dept, weekStart: start, status: "DRAFT" },
      include: {
        cells: { include: { axis: true }, orderBy: [{ workDate: "asc" }] },
      },
    });
  }
  if (!week) {
    throw new DutyScheduleError("Could not open week", "WEEK_OPEN_FAILED", 500);
  }
  const loaded = week;

  const binding = await getBinding(dept);
  const picker = await fetchWorkforcePicker(organizationId);
  const eligible = picker.unavailable
    ? new Set<string>()
    : new Set(
        filterPickerByBinding(picker.items, binding).map((p) => p.globalPersonId),
      );

  const cells = loaded.cells.map((cell) => {
    const orphaned =
      !picker.unavailable &&
      eligible.size > 0 &&
      !eligible.has(cell.globalPersonId);
    return { ...cell, orphaned: orphaned || cell.orphaned };
  });

  return {
    week: { ...loaded, cells },
    binding,
    axes: await listAxes(dept),
    shiftCodes: await listShiftCodes(dept),
    workforceUnavailable: picker.unavailable,
    type: DUTY_SCHEDULE_TYPES[DEPT_DEFAULT_TYPE[dept]],
  };
}

type UpsertCellInput = {
  dept: HotelDutyDept;
  weekStart: string;
  workDate: string;
  axisId: string;
  globalPersonId: string;
  shiftCode: string;
  personName?: string;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  positionId?: string | null;
  positionName?: string | null;
};

export async function upsertCell(input: UpsertCellInput) {
  const { dept, weekStart, workDate, axisId, globalPersonId, shiftCode } = input;
  const allowed = allowedCodesForDept(dept);
  if (!allowed.includes(shiftCode as never)) {
    throw new DutyScheduleError(
      `Shift code ${shiftCode} is not allowed for ${dept}`,
      "INVALID_SHIFT_CODE",
    );
  }

  const view = await getOrCreateWeek(dept, weekStart);
  if (view.week.status === "APPROVED") {
    throw new DutyScheduleError(
      "Approved week is read-only; reopen to draft first",
      "WEEK_APPROVED",
      409,
    );
  }
  if (view.workforceUnavailable) {
    throw new DutyScheduleError(
      "Workforce picker unavailable — cannot save new assignments",
      "ORCH_UNAVAILABLE",
      503,
    );
  }

  const axis = view.axes.find((a) => a.id === axisId);
  if (!axis) {
    throw new DutyScheduleError("Unknown post / crew zone", "AXIS_NOT_FOUND", 404);
  }

  const personnel = await listPersonnel(dept);
  const person = personnel.items.find((p) => p.globalPersonId === globalPersonId);
  if (!person && !input.personName) {
    throw new DutyScheduleError(
      "Person is outside the bound Workforce units/positions",
      "PERSON_NOT_ELIGIBLE",
    );
  }

  const work = weekDate(workDate);
  const conflict = view.week.cells.find(
    (c) =>
      c.globalPersonId === globalPersonId &&
      dayKey(c.workDate) === dayKey(work) &&
      c.axisId !== axisId,
  );
  if (conflict) {
    throw new DutyScheduleError(
      "Person is already assigned to another post/zone on this day",
      "PERSON_DOUBLE_BOOKED",
      409,
    );
  }

  const organizationId = orgId();
  return prisma.dutyScheduleCell.upsert({
    where: {
      weekId_workDate_axisId_globalPersonId: {
        weekId: view.week.id,
        workDate: work,
        axisId,
        globalPersonId,
      },
    },
    create: {
      organizationId,
      weekId: view.week.id,
      workDate: work,
      axisId,
      globalPersonId,
      personName: person?.name ?? input.personName ?? globalPersonId,
      orgUnitId: person?.orgUnitId ?? input.orgUnitId ?? null,
      orgUnitName: person?.orgUnitName ?? input.orgUnitName ?? null,
      positionId: person?.positionId ?? input.positionId ?? null,
      positionName: person?.positionName ?? input.positionName ?? null,
      shiftCode,
      orphaned: false,
    },
    update: {
      shiftCode,
      personName: person?.name ?? input.personName,
      orgUnitId: person?.orgUnitId ?? input.orgUnitId,
      orgUnitName: person?.orgUnitName ?? input.orgUnitName,
      positionId: person?.positionId ?? input.positionId,
      positionName: person?.positionName ?? input.positionName,
      orphaned: false,
    },
    include: { axis: true },
  });
}

export async function deleteCell(cellId: string) {
  const organizationId = orgId();
  const cell = await prisma.dutyScheduleCell.findFirst({
    where: { id: cellId, organizationId },
    include: { week: true },
  });
  if (!cell) {
    throw new DutyScheduleError("Cell not found", "CELL_NOT_FOUND", 404);
  }
  if (cell.week.status === "APPROVED") {
    throw new DutyScheduleError(
      "Approved week is read-only",
      "WEEK_APPROVED",
      409,
    );
  }
  await prisma.dutyScheduleCell.delete({ where: { id: cellId } });
  return { ok: true };
}

export async function setWeekStatus(
  dept: HotelDutyDept,
  weekStart: string,
  status: DutyScheduleWeekStatus,
) {
  const view = await getOrCreateWeek(dept, weekStart);
  return prisma.dutyScheduleWeek.update({
    where: { id: view.week.id },
    data: { status },
    include: {
      cells: { include: { axis: true }, orderBy: [{ workDate: "asc" }] },
    },
  });
}

/**
 * Copy cells from the previous calendar week into this draft week.
 * Refuses when target is APPROVED. Without replace, refuses non-empty target.
 */
export async function copyPreviousWeek(
  dept: HotelDutyDept,
  weekStart: string,
  opts?: { replace?: boolean },
) {
  const view = await getOrCreateWeek(dept, weekStart);
  if (view.week.status === "APPROVED") {
    throw new DutyScheduleError(
      "Approved week is read-only; reopen to draft first",
      "WEEK_APPROVED",
      409,
    );
  }
  const prevStart = shiftYmd(weekStart, -7);
  const organizationId = orgId();
  const source = await prisma.dutyScheduleWeek.findUnique({
    where: {
      organizationId_dept_weekStart: {
        organizationId,
        dept,
        weekStart: weekDate(prevStart),
      },
    },
    include: { cells: true },
  });
  if (!source || source.cells.length === 0) {
    throw new DutyScheduleError(
      "Previous week has no cells to copy",
      "SOURCE_WEEK_EMPTY",
      404,
    );
  }
  if (view.week.cells.length > 0 && !opts?.replace) {
    throw new DutyScheduleError(
      "Current week already has assignments; confirm replace",
      "COPY_TARGET_NOT_EMPTY",
      409,
    );
  }

  const personnel = await listPersonnel(dept);
  const eligible = new Set(personnel.items.map((p) => p.globalPersonId));
  const pickerDown = personnel.unavailable;

  const activeAxisIds = new Set(view.axes.map((a) => a.id));
  const toCopy = source.cells.filter((cell) => activeAxisIds.has(cell.axisId));
  if (toCopy.length === 0) {
    throw new DutyScheduleError(
      "Previous week has no cells on active posts/zones",
      "SOURCE_WEEK_EMPTY",
      404,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (view.week.cells.length > 0) {
      await tx.dutyScheduleCell.deleteMany({ where: { weekId: view.week.id } });
    }
    for (const cell of toCopy) {
      const workDate = shiftYmd(dayKey(cell.workDate), 7);
      const orphaned =
        !pickerDown &&
        eligible.size > 0 &&
        !eligible.has(cell.globalPersonId);
      await tx.dutyScheduleCell.create({
        data: {
          organizationId,
          weekId: view.week.id,
          workDate: weekDate(workDate),
          axisId: cell.axisId,
          globalPersonId: cell.globalPersonId,
          personName: cell.personName,
          orgUnitId: cell.orgUnitId,
          orgUnitName: cell.orgUnitName,
          positionId: cell.positionId,
          positionName: cell.positionName,
          shiftCode: cell.shiftCode,
          orphaned,
        },
      });
    }
  });

  return getOrCreateWeek(dept, weekStart);
}

export async function upsertAxis(
  dept: HotelDutyDept,
  input: {
    code: string;
    name: string;
    kind?: string;
    sortOrder?: number;
    active?: boolean;
  },
) {
  await ensureDeptDefaults(dept);
  const organizationId = orgId();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  if (!code || !input.name.trim()) {
    throw new DutyScheduleError("Axis code and name required", "AXIS_INVALID");
  }
  const kind =
    input.kind?.trim() ||
    (DEPT_DEFAULT_TYPE[dept] === "WEEK_CREW" ? "CREW_ZONE" : "POST");
  return prisma.dutyScheduleAxis.upsert({
    where: { organizationId_dept_code: { organizationId, dept, code } },
    create: {
      organizationId,
      dept,
      code,
      name: input.name.trim(),
      kind,
      sortOrder: input.sortOrder ?? 100,
      active: input.active ?? true,
    },
    update: {
      name: input.name.trim(),
      kind,
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export function parseDeptParam(raw: string | undefined): HotelDutyDept {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!isHotelDutyDept(v)) {
    throw new DutyScheduleError("Unknown department", "UNKNOWN_DEPT", 404);
  }
  return v;
}

export type { DutyScheduleDept };
