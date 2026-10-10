import type { PractitionerStaffKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DESK_KINDS = ["NURSE", "BATH", "MASSAGE"] as const;

/** A procedure code that is not an outpatient doctor visit. */
export function isHandsOnProcedureCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  return c.length > 0 && !c.startsWith("VISIT-");
}

/**
 * Procedure desk: nurses, bath attendants, massage therapists, and doctors who
 * themselves perform a non-visit procedure (skill or duty line). Lab stays out.
 * Visit-only doctors stay out.
 */
export function isProcedureDeskStaff(input: {
  staffKind: PractitionerStaffKind | string;
  procedureCodes?: string[];
}): boolean {
  if (input.staffKind === "LAB") return false;
  if ((DESK_KINDS as readonly string[]).includes(input.staffKind)) return true;
  if (input.staffKind !== "DOCTOR") return false;
  return (input.procedureCodes ?? []).some(isHandsOnProcedureCode);
}

export type ProcedureDeskStaffRow = {
  id: string;
  fullName: string;
  code: string;
  staffKind: PractitionerStaffKind;
  specialty: string | null;
  userId: string | null;
};

export async function listProcedureDeskStaff(): Promise<ProcedureDeskStaffRow[]> {
  const rows = await prisma.practitioner.findMany({
    where: {
      active: true,
      OR: [
        { staffKind: { in: [...DESK_KINDS] } },
        {
          staffKind: "DOCTOR",
          OR: [
            {
              skills: {
                some: {
                  active: true,
                  procedureType: { NOT: { code: { startsWith: "VISIT-" } } },
                },
              },
            },
            {
              dutyLines: {
                some: {
                  procedureType: { NOT: { code: { startsWith: "VISIT-" } } },
                },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      fullName: true,
      code: true,
      staffKind: true,
      specialty: true,
      userId: true,
    },
    orderBy: { fullName: "asc" },
  });
  return rows;
}
