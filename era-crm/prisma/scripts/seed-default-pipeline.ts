/**
 * Seed default Pipeline + 6 PipelineStage rows from LeadStage enum per org.
 */
import { PrismaClient, LeadStage, PipelineStageKind } from "@prisma/client";

const prisma = new PrismaClient();

const STAGES: { legacy: LeadStage; name: string; kind: PipelineStageKind; order: number }[] = [
  { legacy: "NEW", name: "New", kind: "OPEN", order: 1 },
  { legacy: "CONTACTED", name: "Contacted", kind: "OPEN", order: 2 },
  { legacy: "QUALIFIED", name: "Qualified", kind: "OPEN", order: 3 },
  { legacy: "PROPOSAL", name: "Proposal", kind: "OPEN", order: 4 },
  { legacy: "WON", name: "Won", kind: "WON", order: 5 },
  { legacy: "LOST", name: "Lost", kind: "LOST", order: 6 },
];

async function main() {
  const orgs = await prisma.lead.findMany({
    distinct: ["organizationId"],
    select: { organizationId: true },
  });
  const orgIds = new Set(orgs.map((o) => o.organizationId));
  for (const organizationId of orgIds) {
    let pipeline = await prisma.pipeline.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: { organizationId, name: "Default", isDefault: true },
      });
    }
    for (const s of STAGES) {
      const existing = await prisma.pipelineStage.findFirst({
        where: { pipelineId: pipeline.id, legacyStage: s.legacy },
      });
      if (existing) continue;
      await prisma.pipelineStage.create({
        data: {
          organizationId,
          pipelineId: pipeline.id,
          name: s.name,
          sortOrder: s.order,
          kind: s.kind,
          legacyStage: s.legacy,
        },
      });
    }

    // P2 clinic vertical template (CRM stages only — no medical booking API here).
    let clinic = await prisma.pipeline.findFirst({
      where: { organizationId, name: "Clinic inquiry" },
    });
    if (!clinic) {
      clinic = await prisma.pipeline.create({
        data: {
          organizationId,
          name: "Clinic inquiry",
          isDefault: false,
        },
      });
      const clinicStages: {
        legacy: LeadStage;
        name: string;
        kind: PipelineStageKind;
        order: number;
      }[] = [
        { legacy: "NEW", name: "Inquiry", kind: "OPEN", order: 1 },
        { legacy: "CONTACTED", name: "Triaged", kind: "OPEN", order: 2 },
        { legacy: "QUALIFIED", name: "Booked intent", kind: "OPEN", order: 3 },
        { legacy: "PROPOSAL", name: "Package offered", kind: "OPEN", order: 4 },
        { legacy: "WON", name: "Referred to clinic", kind: "WON", order: 5 },
        { legacy: "LOST", name: "Declined", kind: "LOST", order: 6 },
      ];
      for (const s of clinicStages) {
        await prisma.pipelineStage.create({
          data: {
            organizationId,
            pipelineId: clinic.id,
            name: s.name,
            sortOrder: s.order,
            kind: s.kind,
            legacyStage: s.legacy,
          },
        });
      }
    }
  }
  console.log(`seeded pipelines for ${orgIds.size} orgs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
