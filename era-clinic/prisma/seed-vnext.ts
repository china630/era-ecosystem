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
import { permissionsJsonForRole } from "../src/lib/auth/clinic-permissions";
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

/** ServiceCatalogCache only — ClinicalTemplate retired (Diagnostic catalog SoT). */
async function seedDiagnosticCatalog(catalog: DiagnosticCatalog) {
  let catalogCount = 0;

  for (const modality of catalog.modalities) {
    for (const tpl of modality.templates) {
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

  for (const pkg of catalog.packages ?? []) {
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

  return { catalogCount };
}

async function seedDemoAdmin() {
  const password = platformSuperAdminBootstrapPassword();
  const roleCode = process.env.ECOSYSTEM_DEMO_ADMIN_ROLE ?? "CLINIC_ADMIN";
  const logins = [...platformSuperAdminEmails()];
  const extra = process.env.ECOSYSTEM_DEMO_LOGIN?.trim().toLowerCase();
  if (extra?.includes("@") && !logins.includes(extra)) logins.push(extra);

  const role = await prisma.role.upsert({
    where: { code: roleCode },
    update: { name: "Clinic administrator", permissionsJson: permissionsJsonForRole(roleCode) },
    create: {
      code: roleCode,
      name: "Clinic administrator",
      permissionsJson: permissionsJsonForRole(roleCode),
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

  /** Nafta commercial medical packages (Wave A) — quotas filled in Wave B. */
  const naftaPackages: Array<{ code: string; name: string; durationDays: number }> = [
    { code: "PKG-STANDART", name: "Nafta Standart", durationDays: 10 },
    { code: "PKG-PREMIUM", name: "Nafta Premium", durationDays: 10 },
    { code: "PKG-DERMO", name: "Nafta Dermo", durationDays: 10 },
    { code: "PKG-DETOKS", name: "Nafta Detoks", durationDays: 10 },
  ];
  for (const pkg of naftaPackages) {
    const existing = await prisma.programTemplate.findFirst({ where: { code: pkg.code } });
    if (!existing) {
      await prisma.programTemplate.create({
        data: {
          code: pkg.code,
          name: pkg.name,
          durationDays: pkg.durationDays,
          minNights: pkg.code === "PKG-STANDART" ? 5 : 7,
          maxNights: 21,
        },
      });
    } else {
      await prisma.programTemplate.update({
        where: { id: existing.id },
        data: {
          minNights: existing.minNights ?? (pkg.code === "PKG-STANDART" ? 5 : 7),
          maxNights: existing.maxNights ?? 21,
        },
      });
    }
  }

  /** Seed representative PDF bath knots for Standart / Premium (Wave B). */
  async function seedBathKnots(
    code: string,
    knots: Array<{ nights: number; qty: number }>,
  ) {
    const tpl = await prisma.programTemplate.findFirst({ where: { code } });
    if (!tpl) return;
    const hasProc = await prisma.programTemplateProcedure.findFirst({
      where: { templateId: tpl.id, procedureCode: "NAFTALAN_BATH" },
    });
    if (!hasProc) {
      await prisma.programTemplateProcedure.create({
        data: {
          templateId: tpl.id,
          procedureCode: "NAFTALAN_BATH",
          procedureName: "Naftalan bath",
          quotaTotal: knots[0]?.qty ?? 1,
        },
      });
    }
    for (const k of knots) {
      const existingKnot = await prisma.programTemplateQuotaKnot.findFirst({
        where: {
          templateId: tpl.id,
          nights: k.nights,
          procedureCode: "NAFTALAN_BATH",
        },
      });
      if (!existingKnot) {
        await prisma.programTemplateQuotaKnot.create({
          data: {
            templateId: tpl.id,
            nights: k.nights,
            procedureCode: "NAFTALAN_BATH",
            qty: k.qty,
          },
        });
      }
    }
  }

  await seedBathKnots("PKG-STANDART", [
    { nights: 5, qty: 4 },
    { nights: 7, qty: 5 },
    { nights: 8, qty: 6 },
    { nights: 9, qty: 7 },
    { nights: 10, qty: 8 },
    { nights: 11, qty: 8 },
    { nights: 12, qty: 9 },
    { nights: 14, qty: 10 },
    { nights: 21, qty: 14 },
  ]);
  await seedBathKnots("PKG-PREMIUM", [
    { nights: 7, qty: 5 },
    { nights: 10, qty: 8 },
    { nights: 14, qty: 12 },
    { nights: 21, qty: 16 },
  ]);
  await seedBathKnots("PKG-DERMO", [
    { nights: 7, qty: 5 },
    { nights: 10, qty: 8 },
    { nights: 14, qty: 10 },
    { nights: 21, qty: 14 },
  ]);
  await seedBathKnots("PKG-DETOKS", [
    { nights: 7, qty: 5 },
    { nights: 10, qty: 8 },
    { nights: 14, qty: 10 },
    { nights: 21, qty: 14 },
  ]);

  /** Exam-block lines: qty=1 on every knot night (Wave B — not a 5th sell SKU). */
  const EXAM_CODES: Array<{ code: string; name: string }> = [
    { code: "THERAPIST", name: "Therapist exam" },
    { code: "GYN", name: "Gyn/Uro exam" },
    { code: "ECG", name: "ECG" },
    { code: "USG", name: "Ultrasound" },
    { code: "LAB", name: "Lab panel" },
  ];
  async function seedExamKnots(pkgCode: string, nightCols: number[]) {
    const tpl = await prisma.programTemplate.findFirst({ where: { code: pkgCode } });
    if (!tpl) return;
    for (const exam of EXAM_CODES) {
      const hasProc = await prisma.programTemplateProcedure.findFirst({
        where: { templateId: tpl.id, procedureCode: exam.code },
      });
      if (!hasProc) {
        await prisma.programTemplateProcedure.create({
          data: {
            templateId: tpl.id,
            procedureCode: exam.code,
            procedureName: exam.name,
            quotaTotal: 1,
          },
        });
      }
      for (const nights of nightCols) {
        const existingKnot = await prisma.programTemplateQuotaKnot.findFirst({
          where: {
            templateId: tpl.id,
            nights,
            procedureCode: exam.code,
          },
        });
        if (!existingKnot) {
          await prisma.programTemplateQuotaKnot.create({
            data: {
              templateId: tpl.id,
              nights,
              procedureCode: exam.code,
              qty: 1,
            },
          });
        }
      }
    }
  }
  await seedExamKnots("PKG-STANDART", [5, 7, 8, 9, 10, 11, 12, 14, 21]);
  await seedExamKnots("PKG-PREMIUM", [7, 10, 14, 21]);
  await seedExamKnots("PKG-DERMO", [7, 10, 14, 21]);
  await seedExamKnots("PKG-DETOKS", [7, 10, 14, 21]);

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
    catalogCodes: seeded.catalogCount,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
