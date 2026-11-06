import type { PeakDayKind, PeakScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  findPeakOverlap,
  type PeakRule,
} from "@/domain/planning/procedure-day-window";

export class PeakRuleConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictId: string,
  ) {
    super(message);
    this.name = "PeakRuleConflictError";
  }
}

export type PeakRuleInput = {
  fromYmd: string;
  toYmd: string;
  dayKind: PeakDayKind;
  scope: PeakScope;
  startHour?: number | null;
  endHour?: number | null;
  note?: string | null;
};

function toPeakRule(row: {
  id: string;
  fromYmd: string;
  toYmd: string;
  dayKind: PeakDayKind;
  scope: PeakScope;
  startHour: number | null;
  endHour: number | null;
}): PeakRule {
  return {
    id: row.id,
    fromYmd: row.fromYmd,
    toYmd: row.toYmd,
    dayKind: row.dayKind,
    scope: row.scope,
    startHour: row.startHour,
    endHour: row.endHour,
  };
}

export async function listPeakRules(organizationId?: string): Promise<PeakRule[]> {
  const orgId = organizationId ?? requestOrganizationId();
  const rows = await prisma.clinicPeakRule.findMany({
    where: { organizationId: orgId },
    orderBy: [{ fromYmd: "asc" }, { dayKind: "asc" }],
  });
  return rows.map(toPeakRule);
}

/** Load every peak row that may touch [fromYmd, toYmd). */
export async function loadPeakRulesForRange(
  fromYmd: string,
  toYmd: string,
  organizationId?: string,
): Promise<PeakRule[]> {
  const orgId = organizationId ?? requestOrganizationId();
  const last = toYmd > fromYmd ? toYmd : fromYmd;
  const rows = await prisma.clinicPeakRule.findMany({
    where: {
      organizationId: orgId,
      fromYmd: { lte: last },
      toYmd: { gte: fromYmd },
    },
    orderBy: [{ fromYmd: "asc" }, { dayKind: "asc" }],
  });
  return rows.map(toPeakRule);
}

function assertHours(input: PeakRuleInput): void {
  if (input.fromYmd > input.toYmd) {
    throw new Error("Peak rule fromYmd must be on or before toYmd");
  }
  if (input.scope === "OWN_ONLY") return;
  if (input.startHour == null && input.endHour == null) {
    throw new Error("Peak rule needs startHour and/or endHour for this scope");
  }
}

export async function createPeakRule(input: PeakRuleInput): Promise<PeakRule> {
  assertHours(input);
  const organizationId = requestOrganizationId();
  const existing = await listPeakRules(organizationId);
  const conflict = findPeakOverlap(existing, {
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    dayKind: input.dayKind,
    scope: input.scope,
    startHour: input.startHour ?? null,
    endHour: input.endHour ?? null,
  });
  if (conflict?.id) {
    throw new PeakRuleConflictError(
      `Peak rule overlaps ${conflict.fromYmd}…${conflict.toYmd} (${conflict.dayKind})`,
      conflict.id,
    );
  }
  const row = await prisma.clinicPeakRule.create({
    data: {
      organizationId,
      fromYmd: input.fromYmd,
      toYmd: input.toYmd,
      dayKind: input.dayKind,
      scope: input.scope,
      startHour: input.startHour ?? null,
      endHour: input.endHour ?? null,
      note: input.note ?? null,
    },
  });
  return toPeakRule(row);
}

export async function updatePeakRule(id: string, input: PeakRuleInput): Promise<PeakRule> {
  assertHours(input);
  const organizationId = requestOrganizationId();
  const existing = await listPeakRules(organizationId);
  const conflict = findPeakOverlap(
    existing,
    {
      id,
      fromYmd: input.fromYmd,
      toYmd: input.toYmd,
      dayKind: input.dayKind,
      scope: input.scope,
      startHour: input.startHour ?? null,
      endHour: input.endHour ?? null,
    },
    id,
  );
  if (conflict?.id) {
    throw new PeakRuleConflictError(
      `Peak rule overlaps ${conflict.fromYmd}…${conflict.toYmd} (${conflict.dayKind})`,
      conflict.id,
    );
  }
  const row = await prisma.clinicPeakRule.update({
    where: { id },
    data: {
      fromYmd: input.fromYmd,
      toYmd: input.toYmd,
      dayKind: input.dayKind,
      scope: input.scope,
      startHour: input.startHour ?? null,
      endHour: input.endHour ?? null,
      note: input.note ?? null,
    },
  });
  return toPeakRule(row);
}

export async function deletePeakRule(id: string): Promise<void> {
  await prisma.clinicPeakRule.delete({ where: { id } });
}
