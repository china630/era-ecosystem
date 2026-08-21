import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { createSatelliteTenantExtension } from "@era/satellite-kit/tenancy";
import {
  hashPassword,
  platformSuperAdminBootstrapPassword,
  platformSuperAdminEmails,
} from "@era/satellite-kit";
import { ensureDefaultRequirements } from "../src/domain/procedure/procedure-allocation.service";

const requireCjs = createRequire(__filename);
const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

type L10n = { en: string; ru: string; az: string };
type CatalogField = Record<string, unknown>;
type CatalogTemplate = {
  code: string;
  category: string;
  title: L10n;
  serviceCode?: string;
  fields: CatalogField[];
};
type CatalogModality = {
  code: string;
  kind: string;
  title: L10n;
  templates: CatalogTemplate[];
};
type LabPanel = {
  code: string;
  category: string;
  title: L10n;
  serviceCode?: string;
  analytes: CatalogField[];
};
type VisitTemplate = {
  code: string;
  specialty: string;
  title: L10n;
  fields: CatalogField[];
};
type CheckupPackage = {
  code: string;
  title: L10n;
  includes: string[];
};
type DiagnosticCatalog = {
  version?: string;
  commonMetaFields?: CatalogField[];
  modalities: CatalogModality[];
  labPanels: LabPanel[];
  visitTemplates: VisitTemplate[];
  packages?: CheckupPackage[];
};

function loadDiagnosticCatalog(): DiagnosticCatalog {
  const path = join(__dirname, "seed-data", "diagnostic-lab-catalog.json");
  return JSON.parse(readFileSync(path, "utf8")) as DiagnosticCatalog;
}

async function seedDiagnosticCatalog(catalog: DiagnosticCatalog) {
  let clinicalCount = 0;
  let catalogCount = 0;
  const meta = catalog.commonMetaFields ?? [];

  for (const modality of catalog.modalities) {
    for (const tpl of modality.templates) {
      const bodyJson = JSON.stringify({
        kind: modality.kind,
        modality: modality.code,
        category: tpl.category,
        title: tpl.title,
        metaFields: meta,
        fields: tpl.fields,
      });
      await prisma.clinicalTemplate.upsert({
        where: { code: tpl.code },
        create: {
          code: tpl.code,
          title: tpl.title.en,
          specialty: modality.code,
          bodyJson,
        },
        update: {
          title: tpl.title.en,
          specialty: modality.code,
          bodyJson,
        },
      });
      clinicalCount += 1;

      const serviceCode = tpl.serviceCode ?? tpl.code;
      await prisma.serviceCatalogCache.upsert({
        where: { code: serviceCode },
        create: {
          code: serviceCode,
          description: tpl.title.en,
          descriptionAz: tpl.title.az ?? null,
          descriptionRu: tpl.title.ru ?? null,
          descriptionEn: tpl.title.en ?? null,
          amount: 0,
          kind: "DIAGNOSTIC",
        },
        update: {
          description: tpl.title.en,
          descriptionAz: tpl.title.az ?? null,
          descriptionRu: tpl.title.ru ?? null,
          descriptionEn: tpl.title.en ?? null,
          kind: "DIAGNOSTIC",
          syncedAt: new Date(),
        },
      });
      catalogCount += 1;
    }
  }

  for (const panel of catalog.labPanels) {
    const bodyJson = JSON.stringify({
      kind: "lab_panel",
      category: panel.category,
      title: panel.title,
      analytes: panel.analytes,
    });
    await prisma.clinicalTemplate.upsert({
      where: { code: panel.code },
      create: {
        code: panel.code,
        title: panel.title.en,
        specialty: "LAB",
        bodyJson,
      },
      update: {
        title: panel.title.en,
        specialty: "LAB",
        bodyJson,
      },
    });
    clinicalCount += 1;

    const serviceCode = panel.serviceCode ?? panel.code;
    await prisma.serviceCatalogCache.upsert({
      where: { code: serviceCode },
      create: {
        code: serviceCode,
        description: panel.title.en,
        descriptionAz: panel.title.az ?? null,
        descriptionRu: panel.title.ru ?? null,
        descriptionEn: panel.title.en ?? null,
        amount: 0,
        kind: "LAB",
      },
      update: {
        description: panel.title.en,
        descriptionAz: panel.title.az ?? null,
        descriptionRu: panel.title.ru ?? null,
        descriptionEn: panel.title.en ?? null,
        kind: "LAB",
        syncedAt: new Date(),
      },
    });
    catalogCount += 1;
  }

  for (const visit of catalog.visitTemplates) {
    const bodyJson = JSON.stringify({
      kind: "visit",
      specialty: visit.specialty,
      title: visit.title,
      fields: visit.fields,
    });
    await prisma.clinicalTemplate.upsert({
      where: { code: visit.code },
      create: {
        code: visit.code,
        title: visit.title.en,
        specialty: visit.specialty,
        bodyJson,
      },
      update: {
        title: visit.title.en,
        specialty: visit.specialty,
        bodyJson,
      },
    });
    clinicalCount += 1;
  }

  for (const pkg of catalog.packages ?? []) {
    const bodyJson = JSON.stringify({
      kind: "package",
      title: pkg.title,
      includes: pkg.includes,
    });
    await prisma.clinicalTemplate.upsert({
      where: { code: pkg.code },
      create: {
        code: pkg.code,
        title: pkg.title.en,
        specialty: "PACKAGE",
        bodyJson,
      },
      update: {
        title: pkg.title.en,
        specialty: "PACKAGE",
        bodyJson,
      },
    });
    clinicalCount += 1;
    await prisma.serviceCatalogCache.upsert({
      where: { code: pkg.code },
      create: {
        code: pkg.code,
        description: pkg.title.en,
        descriptionAz: pkg.title.az ?? null,
        descriptionRu: pkg.title.ru ?? null,
        descriptionEn: pkg.title.en ?? null,
        amount: 0,
        kind: "OTHER",
      },
      update: {
        description: pkg.title.en,
        descriptionAz: pkg.title.az ?? null,
        descriptionRu: pkg.title.ru ?? null,
        descriptionEn: pkg.title.en ?? null,
        kind: "OTHER",
        syncedAt: new Date(),
      },
    });
    catalogCount += 1;
  }

  return { clinicalCount, catalogCount };
}

async function seedDemoAdmin() {
  const password = platformSuperAdminBootstrapPassword();
  const roleCode = process.env.ECOSYSTEM_DEMO_ADMIN_ROLE ?? "CLINIC_ADMIN";
  const logins = [...platformSuperAdminEmails()];
  const extra = process.env.ECOSYSTEM_DEMO_LOGIN?.trim().toLowerCase();
  if (extra?.includes("@") && !logins.includes(extra)) logins.push(extra);

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
  for (const login of logins) {
    await prisma.user.upsert({
      where: { login },
      create: {
        login,
        email: login,
        fullName: "Platform Super Admin",
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

  const { loadIcd10 } = requireCjs("./load-icd10.cjs") as {
    loadIcd10: (client: PrismaClient, opts?: { force?: boolean }) => Promise<unknown>;
  };
  await loadIcd10(prisma);

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

  // ROOM resources linked to cabinets (Pattern A/B physical locations)
  const cabinetRooms = await prisma.room.findMany({
    where: { code: { in: ["CAB-101", "CAB-102"] } },
  });
  for (const room of cabinetRooms) {
    await prisma.resource.upsert({
      where: { code: room.code },
      update: { roomId: room.id, kind: "ROOM", name: room.name },
      create: {
        code: room.code,
        name: room.name,
        kind: "ROOM",
        capacity: 1,
        roomId: room.id,
      },
    });
  }

  const seededPractitioners = await prisma.practitioner.findMany({
    select: { id: true },
  });
  const seededProcedureTypes = await prisma.procedureType.findMany({
    select: { id: true },
  });
  if (seededPractitioners.length > 0 && seededProcedureTypes.length > 0) {
    await prisma.practitionerSkill.createMany({
      data: seededPractitioners.flatMap((p) =>
        seededProcedureTypes.map((pt) => ({
          practitionerId: p.id,
          procedureTypeId: pt.id,
          active: true,
        })),
      ),
      skipDuplicates: true,
    });
  }
  for (const pt of seededProcedureTypes) {
    await ensureDefaultRequirements(pt.id);
  }

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

  const diagnosticCatalog = loadDiagnosticCatalog();
  const seeded = await seedDiagnosticCatalog(diagnosticCatalog);

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

  console.log("Clinic vNext seed OK", {
    usg: usg.code,
    clinicalTemplates: seeded.clinicalCount,
    catalogCodes: seeded.catalogCount,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
