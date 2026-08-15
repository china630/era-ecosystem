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
  "SVC-TAM-BEDEN-NAFTALAN-VANNASI": "FULL_BODY",
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
      "SVC-TAM-BEDEN-NAFTALAN-VANNASI",
      "SVC-4-KAMERALI-NAFTALAN-VANNASI",
    ],
    scope: "GROUP",
    maxConsecutiveDays: 2,
    restProcedureCode: "SVC-YOD-BROM-VANNASI",
    note: "Max 2 consecutive naftalan bath days, then iod-brom rest day",
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
    originalCode: "SVC-TAM-BEDEN-NAFTALAN-VANNASI",
    substituteCode: "SVC-YOD-BROM-VANNASI",
    note: "Full-body naftalan contraindicated → iod-brom bath (quota preserved)",
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

async function main() {
  await seedBodyPartsAndExtendedHours();
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
