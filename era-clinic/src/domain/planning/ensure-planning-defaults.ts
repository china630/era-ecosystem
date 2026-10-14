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

export type EnsurePlanningDefaultsResult = {
  organizationId: string;
  bodyPartUpdates: number;
  extendedUpdates: number;
  rotations: number;
  substitutions: number;
  cabinPoolLinks: number;
};

export async function ensurePlanningDefaults(
  _db: unknown,
  organizationId: string,
): Promise<EnsurePlanningDefaultsResult> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensurePlanningDefaults");
  }
  return {
    organizationId: orgId,
    bodyPartUpdates: 0,
    extendedUpdates: 0,
    rotations: 0,
    substitutions: 0,
    cabinPoolLinks: 0,
  };
}
