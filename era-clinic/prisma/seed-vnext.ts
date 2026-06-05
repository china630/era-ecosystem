import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.icdCode.createMany({
    data: [
      { code: "J06.9", description: "Acute upper respiratory infection" },
      { code: "I10", description: "Essential hypertension" },
      { code: "E11", description: "Type 2 diabetes mellitus" },
    ],
    skipDuplicates: true,
  });

  await prisma.room.createMany({
    data: [
      { code: "CAB-101", name: "Cabinet 101" },
      { code: "CAB-102", name: "Cabinet 102" },
    ],
    skipDuplicates: true,
  });

  const usg = await prisma.resource.upsert({
    where: { code: "USG-1" },
    update: {},
    create: { code: "USG-1", name: "Ultrasound device", kind: "EQUIPMENT", capacity: 1 },
  });

  await prisma.procedureType.createMany({
    data: [
      {
        code: "MASSAGE",
        name: "Massage",
        durationMin: 45,
        resourceKind: "ROOM",
        resourceCode: "CAB-101",
        bodyPart: "BACK",
        afterLunchAllowed: false,
      },
      {
        code: "USG",
        name: "Ultrasound",
        durationMin: 30,
        resourceKind: "EQUIPMENT",
        resourceCode: "USG-1",
        bodyPart: "ABDOMEN",
        afterLunchAllowed: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.procedureRule.createMany({
    data: [
      {
        beforeCode: "USG",
        afterCode: "MASSAGE",
        kind: "SEQUENCE_GAP",
        minGapMinutes: 120,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.programTemplate.upsert({
    where: { code: "DETOX-7" },
    update: {},
    create: {
      code: "DETOX-7",
      name: "Detox 7 days",
      durationDays: 7,
      procedures: {
        create: [
          { procedureCode: "MASSAGE", procedureName: "Massage", quotaTotal: 5, avoidAfterHour: 14 },
          { procedureCode: "USG", procedureName: "Ultrasound", quotaTotal: 2 },
        ],
      },
    },
  });

  await prisma.clinicalTemplate.createMany({
    data: [
      {
        code: "GP-VISIT",
        title: "General visit",
        specialty: "GP",
        bodyJson: JSON.stringify({ fields: ["complaint", "vitals", "plan"] }),
      },
      {
        code: "CARDIO",
        title: "Cardiology",
        specialty: "CARDIO",
        bodyJson: JSON.stringify({ fields: ["ecg", "diagnosis", "therapy"] }),
      },
    ],
    skipDuplicates: true,
  });

  console.log("Clinic vNext seed OK", { usg: usg.code });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
