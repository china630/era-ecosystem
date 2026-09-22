/**
 * Default planning rules (body-part, rotation, cabin pools, substitutions).
 * Fileless import entity `planning-rules` — replaces boot `seed-planning-rules` on droplet.
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import type { PrismaClient } from "@prisma/client";

const BODY_PART_BY_CODE: Record<string, string> = {
  "SVC-NAFTALAN-VANNASI-QADIN": "FULL_BODY",
  "SVC-NAFTALAN-VANNASI-KISI": "FULL_BODY",
  "SVC-APLIKASIYA-NAFTALAN-QADIN": "FULL_BODY",
  "SVC-APLIKASIYA-NAFTALAN-KISI": "FULL_BODY",
  "SVC-4-KAMERALI-NAFTALAN-VANNASI": "ARM_LEFT",
  "SVC-4-KAMERALI-HIDROQALVANIZASIYA": "ARM_LEFT",
  "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI": "BACK",
  "SVC-ZERBE-DALGA-TERAPIYA": "BACK",
  "SVC-PARAFINOTERAPIYA-BUTUN-BEDEN": "FULL_BODY",
  "SVC-PARAFINOTERAPIYA-BOYUN-KUREK": "NECK",
  "SVC-PARAFINOTERAPIYA-YUXARI-ETRAF": "ARM_LEFT",
  "SVC-PARAFINOTERAPIYA-ASAGI-ETRAF": "LEG_LEFT",
  "SVC-HIDROMASAJ-VANNASI": "FULL_BODY",
  "SVC-YOD-BROM-VANNASI": "FULL_BODY",
  "SVC-TRAKSIYA": "BACK",
};

const NAFTALAN_CABIN_POOLS = {
  QADIN: {
    procedureCodes: ["SVC-NAFTALAN-VANNASI-QADIN", "SVC-APLIKASIYA-NAFTALAN-QADIN"],
    resourceCodes: [
      "RES-VANNA-1-QADIN",
      "RES-VANNA-2-QADIN",
      "RES-VANNA-3-QADIN",
      "RES-VANNA-4-QADIN",
    ],
  },
  KISI: {
    procedureCodes: ["SVC-NAFTALAN-VANNASI-KISI", "SVC-APLIKASIYA-NAFTALAN-KISI"],
    resourceCodes: [
      "RES-VANNA-1-KISI",
      "RES-VANNA-2-KISI",
      "RES-VANNA-3-KISI",
      "RES-VANNA-4-KISI",
    ],
  },
};

const EXTENDED_HOUR_PATTERNS = [
  /lazer/i,
  /laser/i,
  /infra/i,
  /infraqirmizi/i,
  /dars[oa]nval/i,
  /darsonval/i,
  /salux/i,
  /sollyuks/i,
  /sollyux/i,
  /ultrafonoforez/i,
];

const ROTATION_RULES = [
  {
    code: "NAFTALAN_BATH_ROTATION",
    name: "Naftalan bath consecutive-day rotation",
    memberCodes: [
      "SVC-NAFTALAN-VANNASI-QADIN",
      "SVC-NAFTALAN-VANNASI-KISI",
      "SVC-APLIKASIYA-NAFTALAN-QADIN",
      "SVC-APLIKASIYA-NAFTALAN-KISI",
      "SVC-4-KAMERALI-NAFTALAN-VANNASI",
    ],
    scope: "GROUP" as const,
    maxConsecutiveDays: 2,
    restProcedureCode: "SVC-YOD-BROM-VANNASI",
    note: "Max 2 consecutive naftalan bath/aplikasiya days, then iod-brom rest day",
  },
  {
    code: "SUPERINDUCTIVE_BODY_PART",
    name: "Super Inductive same body-part spacing",
    memberCodes: ["SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI"],
    scope: "BODY_PART" as const,
    maxConsecutiveDays: 1,
    restProcedureCode: null as string | null,
    note: "Same body part at most once per consecutive day window",
  },
  {
    code: "ZERBE_DALGA_BODY_PART",
    name: "Shockwave (zerbe) same body-part spacing",
    memberCodes: ["SVC-ZERBE-DALGA-TERAPIYA"],
    scope: "BODY_PART" as const,
    maxConsecutiveDays: 1,
    restProcedureCode: null as string | null,
    note: "Same body part at most once per consecutive day window",
  },
];

const SUBSTITUTION_RULES = [
  {
    originalCode: "SVC-NAFTALAN-VANNASI-QADIN",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "Naftalan ♀ contraindicated → iod-brom bath (quota preserved)",
  },
  {
    originalCode: "SVC-NAFTALAN-VANNASI-KISI",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "Naftalan ♂ contraindicated → iod-brom bath (quota preserved)",
  },
  {
    originalCode: "SVC-APLIKASIYA-NAFTALAN-QADIN",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "Aplikasiya ♀ contraindicated → iod-brom bath",
  },
  {
    originalCode: "SVC-APLIKASIYA-NAFTALAN-KISI",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "Aplikasiya ♂ contraindicated → iod-brom bath",
  },
  {
    originalCode: "SVC-4-KAMERALI-NAFTALAN-VANNASI",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "4-chamber naftalan contraindicated → iod-brom bath",
  },
  {
    originalCode: "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
    substituteCode: "SVC-MAQNITOTERAPIYA",
    note: "Super Inductive blocked body part → magnetotherapy",
  },
  {
    originalCode: "SVC-ZERBE-DALGA-TERAPIYA",
    substituteCode: "SVC-ULTRAFONOFOREZ",
    note: "Shockwave contraindicated → ultrafonophoresis",
  },
];

function needsExtendedHour(code: string, name: string): boolean {
  const hay = `${code} ${name}`;
  return EXTENDED_HOUR_PATTERNS.some((re) => re.test(hay));
}

export type EnsurePlanningDefaultsResult = {
  organizationId: string;
  bodyPartUpdates: number;
  extendedUpdates: number;
  rotations: number;
  substitutions: number;
  cabinPoolLinks: number;
};

type PlanningDb = Pick<
  PrismaClient,
  | "procedureType"
  | "procedureRotationRule"
  | "procedureSubstitutionRule"
  | "procedureTypeRequirement"
>;

export async function ensurePlanningDefaults(
  db: PlanningDb,
  organizationId: string,
): Promise<EnsurePlanningDefaultsResult> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensurePlanningDefaults");
  }

  const types = await db.procedureType.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      code: true,
      name: true,
      bodyPart: true,
      extendedEndHour: true,
    },
  });
  let bodyPartUpdates = 0;
  let extendedUpdates = 0;

  for (const pt of types) {
    const bodyPart = BODY_PART_BY_CODE[pt.code] ?? "FULL_BODY";
    const data: { bodyPart?: string; extendedEndHour?: number } = {};
    if (pt.bodyPart !== bodyPart) data.bodyPart = bodyPart;
    if (needsExtendedHour(pt.code, pt.name) && pt.extendedEndHour !== 22) {
      data.extendedEndHour = 22;
    }
    if (Object.keys(data).length === 0) continue;
    await db.procedureType.update({ where: { id: pt.id }, data });
    if (data.bodyPart) bodyPartUpdates += 1;
    if (data.extendedEndHour === 22) extendedUpdates += 1;
  }

  let rotations = 0;
  for (const rule of ROTATION_RULES) {
    await db.procedureRotationRule.upsert({
      where: { organizationId_code: { organizationId: orgId, code: rule.code } },
      create: {
        organizationId: orgId,
        code: rule.code,
        name: rule.name,
        memberCodes: rule.memberCodes,
        scope: rule.scope,
        maxConsecutiveDays: rule.maxConsecutiveDays,
        restProcedureCode: rule.restProcedureCode,
        note: rule.note,
        active: true,
      },
      update: {
        name: rule.name,
        memberCodes: rule.memberCodes,
        scope: rule.scope,
        maxConsecutiveDays: rule.maxConsecutiveDays,
        restProcedureCode: rule.restProcedureCode,
        note: rule.note,
        active: true,
      },
    });
    rotations += 1;
  }

  let substitutions = 0;
  for (const rule of SUBSTITUTION_RULES) {
    const existing = await db.procedureSubstitutionRule.findFirst({
      where: {
        organizationId: orgId,
        originalCode: rule.originalCode,
        substituteCode: rule.substituteCode,
      },
    });
    if (existing) {
      await db.procedureSubstitutionRule.update({
        where: { id: existing.id },
        data: { active: true, note: rule.note },
      });
    } else {
      await db.procedureSubstitutionRule.create({
        data: {
          organizationId: orgId,
          originalCode: rule.originalCode,
          substituteCode: rule.substituteCode,
          note: rule.note,
          active: true,
        },
      });
    }
    substitutions += 1;
  }

  let cabinPoolLinks = 0;
  for (const pool of Object.values(NAFTALAN_CABIN_POOLS)) {
    for (const procedureCode of pool.procedureCodes) {
      const pt = types.find((t) => t.code === procedureCode);
      if (!pt) continue;
      await db.procedureTypeRequirement.deleteMany({
        where: {
          procedureTypeId: pt.id,
          role: { in: ["LOCATION", "EQUIPMENT"] },
        },
      });
      for (const resourceCode of pool.resourceCodes) {
        await db.procedureTypeRequirement.create({
          data: {
            procedureTypeId: pt.id,
            role: "LOCATION",
            resourceKind: "ROOM",
            resourceCode,
            quantity: 1,
            required: true,
            staffMode: "HARD",
          },
        });
        cabinPoolLinks += 1;
      }
      const hasStaff = await db.procedureTypeRequirement.findFirst({
        where: { procedureTypeId: pt.id, role: "STAFF" },
      });
      if (!hasStaff) {
        await db.procedureTypeRequirement.create({
          data: {
            procedureTypeId: pt.id,
            role: "STAFF",
            staffMode: "SOFT",
            required: true,
          },
        });
      }
    }
  }

  return {
    organizationId: orgId,
    bodyPartUpdates,
    extendedUpdates,
    rotations,
    substitutions,
    cabinPoolLinks,
  };
}
