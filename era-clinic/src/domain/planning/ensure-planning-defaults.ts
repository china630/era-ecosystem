/**
 * Fileless import entity `planning-rules`.
 *
 * Cabins, rotation, substitution, body part, and extended hours are master data
 * (procedure type requirements and /admin/procedure-rules). This import must
 * not rewrite them. A previous version deleted LOCATION rows and wrote
 * fictional RES-VANNA-* codes, and forced rotation and substitution back on.
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

/** Bath day series. Created only when the org has no series with that code; edits in /admin/procedure-rules stay. */
const DAY_SERIES = [
  {
    code: "NAFTALAN",
    name: "Naftalan baths",
    fillsRestDays: false,
    sortOrder: 0,
    members: [
      { procedureCode: "SVC-NAFTALAN-VANNASI-QADIN", shortMark: "Нж" },
      { procedureCode: "SVC-NAFTALAN-VANNASI-KISI", shortMark: "Нм" },
      { procedureCode: "SVC-APLIKASIYA-NAFTALAN-QADIN", shortMark: "Аж" },
      { procedureCode: "SVC-APLIKASIYA-NAFTALAN-KISI", shortMark: "Ам" },
      { procedureCode: "SVC-4-KAMERALI-NAFTALAN-VANNASI", shortMark: "4К" },
    ],
  },
  {
    code: "HYDRO",
    name: "Hydromassage",
    fillsRestDays: true,
    sortOrder: 1,
    members: [{ procedureCode: "SVC-HIDROMASAJ-VANNASI", shortMark: "Г" }],
  },
  {
    code: "IODINE",
    name: "Iodine-bromine",
    fillsRestDays: true,
    sortOrder: 2,
    members: [{ procedureCode: "SVC-YOD-BROM-VANNASI", shortMark: "Й" }],
  },
];

export type EnsurePlanningDefaultsResult = {
  organizationId: string;
  bodyPartUpdates: number;
  extendedUpdates: number;
  rotations: number;
  substitutions: number;
  cabinPoolLinks: number;
  daySeries: number;
};

type PlanningDb = Pick<PrismaClient, "procedureDaySeries" | "procedureDaySeriesMember">;

export async function ensurePlanningDefaults(
  db: PlanningDb,
  organizationId: string,
): Promise<EnsurePlanningDefaultsResult> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensurePlanningDefaults");
  }
  let daySeries = 0;
  for (const series of DAY_SERIES) {
    const existing = await db.procedureDaySeries.findUnique({
      where: { organizationId_code: { organizationId: orgId, code: series.code } },
      select: { id: true },
    });
    if (existing) continue;
    const saved = await db.procedureDaySeries.create({
      data: {
        organizationId: orgId,
        code: series.code,
        name: series.name,
        fillsRestDays: series.fillsRestDays,
        sortOrder: series.sortOrder,
        active: true,
      },
    });
    await db.procedureDaySeriesMember.createMany({
      data: series.members.map((member, index) => ({
        organizationId: orgId,
        seriesId: saved.id,
        procedureCode: member.procedureCode,
        shortMark: member.shortMark,
        sortOrder: index,
      })),
    });
    daySeries += 1;
  }
  return {
    organizationId: orgId,
    bodyPartUpdates: 0,
    extendedUpdates: 0,
    rotations: 0,
    substitutions: 0,
    cabinPoolLinks: 0,
    daySeries,
  };
}
