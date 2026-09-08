#!/usr/bin/env node
/**
 * Ensure PKG-* current templates have intake auto blocks (W2):
 *   SANATORIUM-INTAKE — VISIT, AUTO_ON_OPEN, PER_STAY, requiresDoctor
 *   GYN-OR-URO       — VISIT, AUTO_ON_OPEN, PER_STAY, requiresDoctor
 *   ECG-12           — LAB_ORDER, AUTO_ON_OPEN, PER_STAY
 *   USG-ABD          — LAB_ORDER, AUTO_ON_OPEN, PER_STAY
 *
 * Idempotent. Prefer in-place when zero ProgramInstance pins; bump otherwise.
 *
 * Lives in prisma/ so Docker RUN_SEED (COPY prisma) picks it up.
 * Part of `npm run db:seed` after PKG-* templates exist.
 *
 * Usage:
 *   node prisma/seed-intake-blocks.mjs [--dry-run]
 *   npm run db:seed:intake-blocks
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

const INTAKE_BLOCKS = [
  {
    procedureCode: "SANATORIUM-INTAKE",
    procedureName: "Sanatorium intake / doctor exam",
    kind: "EXAM",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "VISIT",
    quotaBasis: "PER_STAY",
    requiresDoctor: true,
    sortOrder: 0,
  },
  {
    procedureCode: "GYN-OR-URO",
    procedureName: "Gynecologist / urologist exam",
    kind: "EXAM",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "VISIT",
    quotaBasis: "PER_STAY",
    requiresDoctor: true,
    sortOrder: 1,
  },
  {
    procedureCode: "ECG-12",
    procedureName: "ECG 12-lead",
    kind: "LAB",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "LAB_ORDER",
    quotaBasis: "PER_STAY",
    requiresDoctor: false,
    sortOrder: 2,
  },
  {
    procedureCode: "USG-ABD",
    procedureName: "Abdominal ultrasound",
    kind: "LAB",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "LAB_ORDER",
    quotaBasis: "PER_STAY",
    requiresDoctor: false,
    sortOrder: 3,
  },
];

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

async function ensureWritableTemplate(tpl) {
  const pinned = await prisma.programInstance.count({
    where: { templateId: tpl.id },
  });
  if (pinned === 0) return { templateId: tpl.id, bumped: false, pinned: 0 };

  if (dryRun) {
    return { templateId: tpl.id, bumped: true, pinned, dryBump: true };
  }

  await prisma.programTemplate.update({
    where: { id: tpl.id },
    data: { isCurrent: false, retiredAt: new Date() },
  });

  const created = await prisma.programTemplate.create({
    data: {
      id: cuidLike(),
      organizationId: tpl.organizationId,
      code: tpl.code,
      name: tpl.name,
      durationDays: tpl.durationDays,
      minNights: tpl.minNights,
      maxNights: tpl.maxNights,
      effectiveFrom: tpl.effectiveFrom,
      effectiveTo: tpl.effectiveTo,
      version: tpl.version + 1,
      isCurrent: true,
      retiredAt: null,
      supersedesId: tpl.id,
    },
  });

  const procs = await prisma.programTemplateProcedure.findMany({
    where: { templateId: tpl.id },
  });
  for (const p of procs) {
    await prisma.programTemplateProcedure.create({
      data: {
        id: cuidLike(),
        templateId: created.id,
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
        minGapMinutes: p.minGapMinutes,
        avoidAfterHour: p.avoidAfterHour,
        kind: p.kind,
        sortOrder: p.sortOrder,
        assignMode: p.assignMode,
        fulfillment: p.fulfillment,
        quotaBasis: p.quotaBasis,
        requiresDoctor: p.requiresDoctor,
      },
    });
  }
  const knots = await prisma.programTemplateQuotaKnot.findMany({
    where: { templateId: tpl.id },
  });
  for (const k of knots) {
    await prisma.programTemplateQuotaKnot.create({
      data: {
        id: cuidLike(),
        templateId: created.id,
        nights: k.nights,
        procedureCode: k.procedureCode,
        qty: k.qty,
      },
    });
  }
  const members = await prisma.programTemplateBlockMember.findMany({
    where: { templateId: tpl.id },
  });
  for (const m of members) {
    await prisma.programTemplateBlockMember.create({
      data: {
        id: cuidLike(),
        templateId: created.id,
        blockCode: m.blockCode,
        procedureCode: m.procedureCode,
      },
    });
  }

  return { templateId: created.id, bumped: true, pinned };
}

async function ensureIntakeBlocks(templateId, nightCols) {
  const report = { created: [], updated: [], knots: 0 };
  for (const block of INTAKE_BLOCKS) {
    const existing = await prisma.programTemplateProcedure.findFirst({
      where: { templateId, procedureCode: block.procedureCode },
    });
    if (!existing) {
      if (!dryRun) {
        await prisma.programTemplateProcedure.create({
          data: {
            id: cuidLike(),
            templateId,
            procedureCode: block.procedureCode,
            procedureName: block.procedureName,
            quotaTotal: 1,
            kind: block.kind,
            sortOrder: block.sortOrder,
            assignMode: block.assignMode,
            fulfillment: block.fulfillment,
            quotaBasis: block.quotaBasis,
            requiresDoctor: block.requiresDoctor,
          },
        });
      }
      report.created.push(block.procedureCode);
    } else {
      const needsUpdate =
        existing.assignMode !== block.assignMode ||
        existing.fulfillment !== block.fulfillment ||
        existing.quotaBasis !== block.quotaBasis ||
        existing.requiresDoctor !== block.requiresDoctor ||
        existing.kind !== block.kind;
      if (needsUpdate) {
        if (!dryRun) {
          await prisma.programTemplateProcedure.update({
            where: { id: existing.id },
            data: {
              assignMode: block.assignMode,
              fulfillment: block.fulfillment,
              quotaBasis: block.quotaBasis,
              requiresDoctor: block.requiresDoctor,
              kind: block.kind,
              procedureName: existing.procedureName || block.procedureName,
            },
          });
        }
        report.updated.push(block.procedureCode);
      }
    }

    const cols = nightCols.length > 0 ? nightCols : [7, 10, 14, 21];
    for (const nights of cols) {
      const knot = await prisma.programTemplateQuotaKnot.findFirst({
        where: {
          templateId,
          nights,
          procedureCode: block.procedureCode,
        },
      });
      if (!knot) {
        if (!dryRun) {
          await prisma.programTemplateQuotaKnot.create({
            data: {
              id: cuidLike(),
              templateId,
              nights,
              procedureCode: block.procedureCode,
              qty: 1,
            },
          });
        }
        report.knots += 1;
      }
    }
  }
  return report;
}

async function main() {
  const templates = await prisma.programTemplate.findMany({
    where: {
      isCurrent: true,
      code: { startsWith: "PKG-" },
    },
    orderBy: { code: "asc" },
  });

  console.log(
    `Found ${templates.length} current PKG-* template(s)${dryRun ? " [dry-run]" : ""}`,
  );

  for (const tpl of templates) {
    const { templateId, bumped, pinned } = await ensureWritableTemplate(tpl);
    const knots = await prisma.programTemplateQuotaKnot.findMany({
      where: { templateId: bumped && !dryRun ? templateId : tpl.id },
      select: { nights: true },
    });
    const nightCols = [...new Set(knots.map((k) => k.nights))].sort(
      (a, b) => a - b,
    );
    const targetId = dryRun && bumped ? tpl.id : templateId;
    const report = await ensureIntakeBlocks(targetId, nightCols);
    console.log(
      `${tpl.code} v${tpl.version}${bumped ? ` → bump (pins=${pinned})` : " in-place"}:`,
      `created=[${report.created.join(",")}]`,
      `updated=[${report.updated.join(",")}]`,
      `knots+${report.knots}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
