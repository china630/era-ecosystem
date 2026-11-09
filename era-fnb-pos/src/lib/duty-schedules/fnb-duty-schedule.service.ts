import type { FnbDutyWeekStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { FNB_ALLOWED_SHIFT_CODES, FNB_DUTY_TYPE, FNB_SHIFT_CODE_SEED } from "./catalog";
import {
  fetchWorkforcePicker,
  filterPickerByBinding,
  type WorkforcePickerItem,
} from "./picker";
import { shiftYmd } from "./week-math";

export { shiftYmd };

export class FnbDutyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "FnbDutyError";
  }
}

function orgId() {
  return requestOrganizationId();
}

function weekDate(weekStart: string) {
  return new Date(`${weekStart.slice(0, 10)}T00:00:00.000Z`);
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/** Concurrent page loads race on create — treat P2002 as already seeded. */
export async function ensureFnbDutyDefaults() {
  const organizationId = orgId();
  try {
    await prisma.fnbDutyScheduleBinding.upsert({
      where: { organizationId },
      create: {
        organizationId,
        orgUnitIds: [],
        positionIds: [],
        outletIds: [],
      },
      update: {},
    });
  } catch (err) {
    if (!isUniqueConflict(err)) throw err;
  }
  for (const row of FNB_SHIFT_CODE_SEED) {
    try {
      await prisma.fnbDutyShiftCode.upsert({
        where: { organizationId_code: { organizationId, code: row.code } },
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
    } catch (err) {
      if (!isUniqueConflict(err)) throw err;
    }
  }
}

export async function getBinding() {
  await ensureFnbDutyDefaults();
  return prisma.fnbDutyScheduleBinding.findUniqueOrThrow({
    where: { organizationId: orgId() },
  });
}

export async function upsertBinding(input: {
  orgUnitIds?: string[];
  positionIds?: string[];
  outletIds?: string[];
}) {
  await ensureFnbDutyDefaults();
  return prisma.fnbDutyScheduleBinding.update({
    where: { organizationId: orgId() },
    data: {
      orgUnitIds: input.orgUnitIds ?? [],
      positionIds: input.positionIds ?? [],
      outletIds: input.outletIds ?? [],
    },
  });
}

export async function listShiftCodes() {
  await ensureFnbDutyDefaults();
  return prisma.fnbDutyShiftCode.findMany({
    where: { organizationId: orgId(), active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
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

export async function listPersonnel(selectedOrgUnitIds?: string[]) {
  const binding = await getBinding();
  const picker = await fetchWorkforcePicker(orgId());
  if (picker.unavailable) {
    return {
      items: [] as WorkforcePickerItem[],
      unavailable: true,
      binding,
      orgUnitOptions: [] as Array<{ value: string; label: string }>,
    };
  }
  return {
    items: filterPickerByBinding(picker.items, binding, selectedOrgUnitIds),
    unavailable: false,
    binding,
    /** Full picker units for binding MULTI — not filtered by current binding. */
    orgUnitOptions: orgUnitOptionsFromPicker(picker.items),
  };
}

export async function listOutlets() {
  return prisma.outlet.findMany({
    where: { organizationId: orgId(), active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function getOrCreateWeek(weekStart: string) {
  await ensureFnbDutyDefaults();
  const organizationId = orgId();
  const start = weekDate(weekStart);
  let week = await prisma.fnbDutyScheduleWeek.findUnique({
    where: { organizationId_weekStart: { organizationId, weekStart: start } },
    include: { cells: { orderBy: [{ personName: "asc" }, { workDate: "asc" }] } },
  });
  if (!week) {
    try {
      week = await prisma.fnbDutyScheduleWeek.create({
        data: { organizationId, weekStart: start, status: "DRAFT" },
        include: { cells: true },
      });
    } catch (err) {
      if (!isUniqueConflict(err)) throw err;
      week = await prisma.fnbDutyScheduleWeek.findUnique({
        where: { organizationId_weekStart: { organizationId, weekStart: start } },
        include: {
          cells: { orderBy: [{ personName: "asc" }, { workDate: "asc" }] },
        },
      });
    }
  }
  if (!week) {
    throw new FnbDutyError("Could not open week", "WEEK_OPEN_FAILED", 500);
  }
  const loaded = week;

  const binding = await getBinding();
  const picker = await fetchWorkforcePicker(organizationId);
  const eligible = picker.unavailable
    ? new Set<string>()
    : new Set(
        filterPickerByBinding(picker.items, binding).map((p) => p.globalPersonId),
      );

  const cells = loaded.cells.map((cell) => ({
    ...cell,
    orphaned:
      cell.orphaned ||
      (!picker.unavailable &&
        eligible.size > 0 &&
        !eligible.has(cell.globalPersonId)),
  }));

  return {
    type: FNB_DUTY_TYPE,
    week: { ...loaded, cells },
    binding,
    shiftCodes: await listShiftCodes(),
    outlets: await listOutlets(),
    workforceUnavailable: picker.unavailable,
  };
}

export async function upsertCell(input: {
  weekStart: string;
  workDate: string;
  globalPersonId: string;
  shiftCode: string;
  personName?: string;
  positionName?: string | null;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  positionId?: string | null;
  outletId?: string | null;
  outletName?: string | null;
}) {
  if (!FNB_ALLOWED_SHIFT_CODES.has(input.shiftCode)) {
    throw new FnbDutyError(
      `Unknown shift code ${input.shiftCode}`,
      "INVALID_SHIFT_CODE",
    );
  }
  const view = await getOrCreateWeek(input.weekStart);
  if (view.week.status === "APPROVED") {
    throw new FnbDutyError("Approved week is read-only", "WEEK_APPROVED", 409);
  }
  if (view.workforceUnavailable) {
    throw new FnbDutyError(
      "Workforce picker unavailable",
      "ORCH_UNAVAILABLE",
      503,
    );
  }
  const personnel = await listPersonnel();
  const person = personnel.items.find(
    (p) => p.globalPersonId === input.globalPersonId,
  );
  if (!person && !input.personName) {
    throw new FnbDutyError("Person not eligible", "PERSON_NOT_ELIGIBLE");
  }

  let outletName = input.outletName ?? null;
  if (input.outletId) {
    const outlet = view.outlets.find((o) => o.id === input.outletId);
    outletName = outlet?.name ?? outletName;
  }

  const work = weekDate(input.workDate);
  return prisma.fnbDutyScheduleCell.upsert({
    where: {
      weekId_workDate_globalPersonId: {
        weekId: view.week.id,
        workDate: work,
        globalPersonId: input.globalPersonId,
      },
    },
    create: {
      organizationId: orgId(),
      weekId: view.week.id,
      workDate: work,
      globalPersonId: input.globalPersonId,
      personName: person?.name ?? input.personName ?? input.globalPersonId,
      positionName: person?.positionName ?? input.positionName ?? null,
      orgUnitId: person?.orgUnitId ?? input.orgUnitId ?? null,
      orgUnitName: person?.orgUnitName ?? input.orgUnitName ?? null,
      positionId: person?.positionId ?? input.positionId ?? null,
      outletId: input.outletId ?? null,
      outletName,
      shiftCode: input.shiftCode,
      orphaned: false,
    },
    update: {
      shiftCode: input.shiftCode,
      personName: person?.name ?? input.personName,
      positionName: person?.positionName ?? input.positionName,
      orgUnitId: person?.orgUnitId ?? input.orgUnitId,
      orgUnitName: person?.orgUnitName ?? input.orgUnitName,
      positionId: person?.positionId ?? input.positionId,
      outletId: input.outletId,
      outletName,
      orphaned: false,
    },
  });
}

export async function deleteCell(cellId: string) {
  const cell = await prisma.fnbDutyScheduleCell.findFirst({
    where: { id: cellId, organizationId: orgId() },
    include: { week: true },
  });
  if (!cell) throw new FnbDutyError("Cell not found", "CELL_NOT_FOUND", 404);
  if (cell.week.status === "APPROVED") {
    throw new FnbDutyError("Approved week is read-only", "WEEK_APPROVED", 409);
  }
  await prisma.fnbDutyScheduleCell.delete({ where: { id: cellId } });
  return { ok: true };
}

export async function setWeekStatus(
  weekStart: string,
  status: FnbDutyWeekStatus,
) {
  const view = await getOrCreateWeek(weekStart);
  return prisma.fnbDutyScheduleWeek.update({
    where: { id: view.week.id },
    data: { status },
    include: { cells: { orderBy: [{ personName: "asc" }, { workDate: "asc" }] } },
  });
}

function dayKey(d: Date | string) {
  return String(d).slice(0, 10);
}

export async function copyPreviousWeek(
  weekStart: string,
  opts?: { replace?: boolean },
) {
  const view = await getOrCreateWeek(weekStart);
  if (view.week.status === "APPROVED") {
    throw new FnbDutyError("Approved week is read-only", "WEEK_APPROVED", 409);
  }
  const prevStart = shiftYmd(weekStart, -7);
  const organizationId = orgId();
  const source = await prisma.fnbDutyScheduleWeek.findUnique({
    where: {
      organizationId_weekStart: {
        organizationId,
        weekStart: weekDate(prevStart),
      },
    },
    include: { cells: true },
  });
  if (!source || source.cells.length === 0) {
    throw new FnbDutyError(
      "Previous week has no cells to copy",
      "SOURCE_WEEK_EMPTY",
      404,
    );
  }
  if (view.week.cells.length > 0 && !opts?.replace) {
    throw new FnbDutyError(
      "Current week already has assignments; confirm replace",
      "COPY_TARGET_NOT_EMPTY",
      409,
    );
  }

  const personnel = await listPersonnel();
  const eligible = new Set(personnel.items.map((p) => p.globalPersonId));
  const pickerDown = personnel.unavailable;

  await prisma.$transaction(async (tx) => {
    if (view.week.cells.length > 0) {
      await tx.fnbDutyScheduleCell.deleteMany({ where: { weekId: view.week.id } });
    }
    for (const cell of source.cells) {
      const workDate = shiftYmd(dayKey(cell.workDate), 7);
      const orphaned =
        !pickerDown &&
        eligible.size > 0 &&
        !eligible.has(cell.globalPersonId);
      await tx.fnbDutyScheduleCell.create({
        data: {
          organizationId,
          weekId: view.week.id,
          workDate: weekDate(workDate),
          globalPersonId: cell.globalPersonId,
          personName: cell.personName,
          positionName: cell.positionName,
          orgUnitId: cell.orgUnitId,
          orgUnitName: cell.orgUnitName,
          positionId: cell.positionId,
          outletId: cell.outletId,
          outletName: cell.outletName,
          shiftCode: cell.shiftCode,
          orphaned,
        },
      });
    }
  });

  return getOrCreateWeek(weekStart);
}
