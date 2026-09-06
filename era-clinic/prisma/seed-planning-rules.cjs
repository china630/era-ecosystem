"use strict";

/**
 * Idempotent seed: ProcedureType.bodyPart / extendedEndHour + rotation/substitution rules.
 * Run: node prisma/seed-planning-rules.cjs
 */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function cuidLike() {
  return "c" + crypto.randomBytes(12).toString("hex");
}

/** Explicit body-part overrides (code → BodyPart). Unlisted types default to FULL_BODY. */
const BODY_PART_BY_CODE = {
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

/** ♀/♂ naftalan immersion + aplikasiya share the same gender cabin pool. */
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

/** Name/code substrings → extendedEndHour=22 (peak / late modalities). */
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
    scope: "GROUP",
    maxConsecutiveDays: 2,
    restProcedureCode: "SVC-YOD-BROM-VANNASI",
    note: "Max 2 consecutive naftalan bath/aplikasiya days, then iod-brom rest day",
  },
  {
    code: "SUPERINDUCTIVE_BODY_PART",
    name: "Super Inductive same body-part spacing",
    memberCodes: ["SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI"],
    scope: "BODY_PART",
    maxConsecutiveDays: 1,
    restProcedureCode: null,
    note: "Same body part at most once per consecutive day window",
  },
  {
    code: "ZERBE_DALGA_BODY_PART",
    name: "Shockwave (zerbe) same body-part spacing",
    memberCodes: ["SVC-ZERBE-DALGA-TERAPIYA"],
    scope: "BODY_PART",
    maxConsecutiveDays: 1,
    restProcedureCode: null,
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

function needsExtendedHour(code, name) {
  const hay = `${code} ${name}`;
  return EXTENDED_HOUR_PATTERNS.some((re) => re.test(hay));
}

async function seedBodyPartsAndExtendedHours() {
  const types = await prisma.procedureType.findMany({
    select: { id: true, code: true, name: true, bodyPart: true, extendedEndHour: true },
  });
  let bodyPartUpdates = 0;
  let extendedUpdates = 0;

  for (const pt of types) {
    const bodyPart = BODY_PART_BY_CODE[pt.code] ?? "FULL_BODY";
    const extendedEndHour = needsExtendedHour(pt.code, pt.name) ? 22 : pt.extendedEndHour;
    const data = {};
    if (pt.bodyPart !== bodyPart) data.bodyPart = bodyPart;
    if (needsExtendedHour(pt.code, pt.name) && pt.extendedEndHour !== 22) {
      data.extendedEndHour = 22;
    }
    if (Object.keys(data).length === 0) continue;
    await prisma.procedureType.update({ where: { id: pt.id }, data });
    if (data.bodyPart) bodyPartUpdates++;
    if (data.extendedEndHour === 22) extendedUpdates++;
  }

  console.log(
    `ProcedureType: bodyPart set/updated=${bodyPartUpdates}, extendedEndHour=22 set=${extendedUpdates} (of ${types.length} types)`,
  );
}

async function seedRotationRules() {
  for (const rule of ROTATION_RULES) {
    await prisma.procedureRotationRule.upsert({
      where: { code: rule.code },
      update: {
        name: rule.name,
        memberCodes: rule.memberCodes,
        scope: rule.scope,
        maxConsecutiveDays: rule.maxConsecutiveDays,
        restProcedureCode: rule.restProcedureCode,
        active: true,
        note: rule.note,
      },
      create: {
        id: cuidLike(),
        code: rule.code,
        name: rule.name,
        memberCodes: rule.memberCodes,
        scope: rule.scope,
        maxConsecutiveDays: rule.maxConsecutiveDays,
        restProcedureCode: rule.restProcedureCode,
        active: true,
        note: rule.note,
      },
    });
  }
  console.log(`ProcedureRotationRule upserted: ${ROTATION_RULES.length}`);
}

async function seedSubstitutionRules() {
  let upserted = 0;
  for (const rule of SUBSTITUTION_RULES) {
    const existing = await prisma.procedureSubstitutionRule.findFirst({
      where: {
        originalCode: rule.originalCode,
        substituteCode: rule.substituteCode,
      },
    });
    if (existing) {
      await prisma.procedureSubstitutionRule.update({
        where: { id: existing.id },
        data: { active: true, note: rule.note },
      });
    } else {
      await prisma.procedureSubstitutionRule.create({
        data: {
          id: cuidLike(),
          originalCode: rule.originalCode,
          substituteCode: rule.substituteCode,
          active: true,
          note: rule.note,
        },
      });
    }
    upserted++;
  }
  console.log(`ProcedureSubstitutionRule upserted: ${upserted}`);
}

async function seedNaftalanSharedCabinRequirements() {
  let wired = 0;
  for (const pool of Object.values(NAFTALAN_CABIN_POOLS)) {
    for (const code of pool.procedureCodes) {
      const pt = await prisma.procedureType.findFirst({ where: { code } });
      if (!pt) {
        console.warn(`[seed-planning-rules] missing procedure type ${code}`);
        continue;
      }
      await prisma.procedureTypeRequirement.deleteMany({
        where: { procedureTypeId: pt.id, role: { in: ["LOCATION", "EQUIPMENT"] } },
      });
      for (const resourceCode of pool.resourceCodes) {
        await prisma.procedureTypeRequirement.create({
          data: {
            procedureTypeId: pt.id,
            role: "LOCATION",
            resourceKind: "ROOM",
            resourceCode,
            staffMode: "HARD",
            required: true,
          },
        });
      }
      const hasStaff = await prisma.procedureTypeRequirement.findFirst({
        where: { procedureTypeId: pt.id, role: "STAFF" },
      });
      if (!hasStaff) {
        await prisma.procedureTypeRequirement.create({
          data: {
            procedureTypeId: pt.id,
            role: "STAFF",
            staffMode: "SOFT",
            required: true,
          },
        });
      }
      wired++;
    }
  }
  console.log(`Naftalan shared cabin LOCATION requirements wired: ${wired} types`);
}

async function main() {
  await seedBodyPartsAndExtendedHours();
  await seedNaftalanSharedCabinRequirements();
  await seedRotationRules();
  await seedSubstitutionRules();
  console.log("seed-planning-rules: done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
