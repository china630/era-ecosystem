/**
 * Merge WO cutover catalog (WO-TR-* / WO-ROOM-*) onto Nafta seed (SVC-* / CAB-*).
 * Keeps ProcedureOrder.scheduledAt (WO times). Deletes duplicate WO types/rooms.
 *
 *   npx tsx scripts/nafta-cutover/merge-seed-wo-catalog.ts
 *   npx tsx scripts/nafta-cutover/merge-seed-wo-catalog.ts --apply
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  isWoProcedureCode,
  isWoRoomCode,
  matchProcedureToSeed,
  matchRoomToSeed,
  type CatalogNameRow,
} from "../../src/lib/import/seed-catalog-match";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(__dirname, "../../prisma/seed-data/nafta", rel), "utf8")) as T;
}

type IdName = { id: string; code: string; name: string };

async function remapProcedureCode(
  from: string,
  to: string,
  seedId: string,
  seedName: string,
  woTypeId: string,
) {
  await prisma.procedureOrder.updateMany({
    where: { OR: [{ procedureCode: from }, { procedureTypeId: woTypeId }] },
    data: { procedureCode: to, procedureTypeId: seedId, procedureName: seedName },
  });
  await prisma.programTemplateProcedure.updateMany({
    where: { procedureCode: from },
    data: { procedureCode: to, procedureName: seedName },
  });
  await prisma.procedureCompatibilityRule.updateMany({
    where: { procedureCodeA: from },
    data: { procedureCodeA: to },
  });
  await prisma.procedureCompatibilityRule.updateMany({
    where: { procedureCodeB: from },
    data: { procedureCodeB: to },
  });
  await prisma.procedureChargeLog.updateMany({
    where: { procedureCode: from },
    data: { procedureCode: to, procedureName: seedName },
  });

  const knots = await prisma.programTemplateQuotaKnot.findMany({ where: { procedureCode: from } });
  for (const knot of knots) {
    const clash = await prisma.programTemplateQuotaKnot.findUnique({
      where: {
        templateId_nights_procedureCode: {
          templateId: knot.templateId,
          nights: knot.nights,
          procedureCode: to,
        },
      },
    });
    if (clash) {
      await prisma.programTemplateQuotaKnot.update({
        where: { id: clash.id },
        data: { qty: clash.qty + knot.qty },
      });
      await prisma.programTemplateQuotaKnot.delete({ where: { id: knot.id } });
    } else {
      await prisma.programTemplateQuotaKnot.update({
        where: { id: knot.id },
        data: { procedureCode: to },
      });
    }
  }

  const balances = await prisma.programProcedureBalance.findMany({ where: { procedureCode: from } });
  for (const line of balances) {
    const clash = await prisma.programProcedureBalance.findUnique({
      where: { instanceId_procedureCode: { instanceId: line.instanceId, procedureCode: to } },
    });
    if (clash) {
      await prisma.programProcedureBalance.update({
        where: { id: clash.id },
        data: {
          quotaTotal: Math.max(clash.quotaTotal, line.quotaTotal),
          quotaUsed: Math.max(clash.quotaUsed, line.quotaUsed),
        },
      });
      await prisma.programProcedureBalance.delete({ where: { id: line.id } });
    } else {
      await prisma.programProcedureBalance.update({
        where: { id: line.id },
        data: { procedureCode: to },
      });
    }
  }

  const skills = await prisma.practitionerSkill.findMany({ where: { procedureTypeId: woTypeId } });
  for (const skill of skills) {
    const clash = await prisma.practitionerSkill.findUnique({
      where: {
        practitionerId_procedureTypeId: { practitionerId: skill.practitionerId, procedureTypeId: seedId },
      },
    });
    if (clash) await prisma.practitionerSkill.delete({ where: { id: skill.id } });
    else {
      await prisma.practitionerSkill.update({
        where: { id: skill.id },
        data: { procedureTypeId: seedId },
      });
    }
  }

  const reqs = await prisma.procedureTypeRequirement.findMany({ where: { procedureTypeId: woTypeId } });
  for (const req of reqs) {
    await prisma.procedureTypeRequirement.update({
      where: { id: req.id },
      data: { procedureTypeId: seedId },
    });
  }

  await prisma.cutoverImportKey.updateMany({
    where: { entity: "procedures", recordId: woTypeId },
    data: { recordId: seedId },
  });
}

async function main() {
  const seedProcs = loadJson<CatalogNameRow[]>("procedure-types.json");
  const seedCabs = loadJson<CatalogNameRow[]>("cabinets.json");

  const types = (await prisma.procedureType.findMany({
    select: { id: true, code: true, name: true },
  })) as IdName[];
  const rooms = (await prisma.room.findMany({
    select: { id: true, code: true, name: true },
  })) as IdName[];

  const procPlan: Array<{ from: IdName; to: CatalogNameRow & { id: string } }> = [];
  const procUnmatched: IdName[] = [];
  for (const row of types.filter((t) => isWoProcedureCode(t.code))) {
    const hit = matchProcedureToSeed(row.name, seedProcs) ?? matchProcedureToSeed(row.code, seedProcs);
    const live = hit ? types.find((t) => t.code === hit.code) : null;
    if (hit && live) procPlan.push({ from: row, to: { ...hit, id: live.id } });
    else procUnmatched.push(row);
  }

  const roomPlan: Array<{ from: IdName; to: CatalogNameRow & { id: string } }> = [];
  const roomUnmatched: IdName[] = [];
  for (const row of rooms.filter((r) => isWoRoomCode(r.code))) {
    const hit = matchRoomToSeed(row.name, seedCabs) ?? matchRoomToSeed(row.code, seedCabs);
    const live = hit ? rooms.find((r) => r.code === hit.code) : null;
    if (hit && live) roomPlan.push({ from: row, to: { ...hit, id: live.id } });
    else roomUnmatched.push(row);
  }

  const report = {
    apply: APPLY,
    procedures: {
      merge: procPlan.map((p) => ({ wo: p.from.code, seed: p.to.code, name: p.to.name })),
      unmatched: procUnmatched.map((p) => ({ code: p.code, name: p.name })),
    },
    rooms: {
      merge: roomPlan.map((p) => ({ wo: p.from.code, seed: p.to.code, name: p.to.name })),
      unmatched: roomUnmatched.map((p) => ({ code: p.code, name: p.name })),
    },
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  for (const p of procPlan) {
    await remapProcedureCode(p.from.code, p.to.code, p.to.id, p.to.name, p.from.id);
    await prisma.procedureType.delete({ where: { id: p.from.id } });
  }

  for (const p of roomPlan) {
    const woRes = await prisma.resource.findFirst({ where: { roomId: p.from.id } });
    const seedRes = await prisma.resource.findFirst({ where: { roomId: p.to.id } });
    if (woRes && seedRes) {
      await prisma.procedureOrder.updateMany({
        where: { resourceId: woRes.id },
        data: { resourceId: seedRes.id },
      });
      await prisma.procedureTypeRequirement.updateMany({
        where: { resourceCode: woRes.code },
        data: { resourceCode: seedRes.code },
      });
      await prisma.resource.delete({ where: { id: woRes.id } });
    }
    await prisma.cutoverImportKey.updateMany({
      where: { entity: "rooms", recordId: p.from.id },
      data: { recordId: p.to.id },
    });
    await prisma.room.delete({ where: { id: p.from.id } });
  }

  console.log("MERGE OK", {
    proceduresDeleted: procPlan.length,
    roomsDeleted: roomPlan.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
