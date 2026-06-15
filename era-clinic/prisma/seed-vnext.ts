import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@era/satellite-kit";

const prisma = new PrismaClient();

async function seedDemoAdmin() {
  const login = (process.env.ECOSYSTEM_DEMO_LOGIN ?? "chingiz@era.com").toLowerCase();
  const password = process.env.ECOSYSTEM_DEMO_PASSWORD ?? "12345678";
  const roleCode = process.env.ECOSYSTEM_DEMO_ADMIN_ROLE ?? "CLINIC_ADMIN";

  const role = await prisma.role.upsert({
    where: { code: roleCode },
    update: { name: "Clinic administrator" },
    create: {
      code: roleCode,
      name: "Clinic administrator",
      permissionsJson: "[]",
    },
  });

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { login },
    create: {
      login,
      email: login,
      fullName: "Chingiz Demo",
      passwordHash,
      roleId: role.id,
      status: "ACTIVE",
      isCrossSystem: true,
    },
    update: {
      email: login,
      passwordHash,
      roleId: role.id,
      status: "ACTIVE",
      isCrossSystem: true,
    },
  });
}

async function main() {
  await prisma.tenant.upsert({
    where: { code: "default" },
    update: {
      name: "Nafta Clinic",
      enabledPresets: ["outpatient", "sanatorium_clinical", "inpatient_day"],
    },
    create: {
      code: "default",
      name: "Nafta Clinic",
      enabledPresets: ["outpatient", "sanatorium_clinical", "inpatient_day"],
    },
  });

  await seedDemoAdmin();

  await prisma.practitioner.createMany({
    data: [
      { code: "DR-01", fullName: "Dr. Aliyev", specialty: "GP" },
      { code: "DR-02", fullName: "Dr. Mammadova", specialty: "Cardiology" },
    ],
    skipDuplicates: true,
  });

  await prisma.icdCode.createMany({
    data: [
      { code: "J06.9", description: "Acute upper respiratory infection" },
      { code: "I10", description: "Essential hypertension" },
      { code: "E11", description: "Type 2 diabetes mellitus" },
      { code: "M54.5", description: "Low back pain" },
      { code: "J45.9", description: "Asthma, unspecified" },
      { code: "K21.0", description: "Gastro-esophageal reflux disease with esophagitis" },
      { code: "F41.1", description: "Generalized anxiety disorder" },
      { code: "Z00.0", description: "General medical examination" },
    ],
    skipDuplicates: true,
  });

  const wardA = await prisma.ward.upsert({
    where: { code: "WARD-A" },
    update: { name: "General ward A", dailyChargeCode: "WARD-DAY-A" },
    create: { code: "WARD-A", name: "General ward A", dailyChargeCode: "WARD-DAY-A" },
  });
  await prisma.bed.createMany({
    data: [
      { wardId: wardA.id, code: "A1", status: "AVAILABLE" },
      { wardId: wardA.id, code: "A2", status: "AVAILABLE" },
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

  await prisma.lisFileProfile.upsert({
    where: { name: "default-csv" },
    update: {},
    create: {
      name: "default-csv",
      format: "CSV",
      delimiter: ",",
      columnMapping: JSON.stringify({
        testCode: "testCode",
        analyte: "analyte",
        value: "value",
        refMin: "refMin",
        refMax: "refMax",
      }),
    },
  });

  console.log("Clinic vNext seed OK", { usg: usg.code });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
