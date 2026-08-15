/**
 * Idempotent seed: diagnostic/lab catalog JSON -> Modality / DiagnosticService /
 * DiagnosticAnalyte / DiagnosticMetaField (Phase 2 of lab-orders DB normalization).
 *
 * Source: prisma/seed-data/diagnostic-lab-catalog.json
 * Safe to re-run: upserts by unique code/key, does not delete existing rows.
 *
 * Run: node prisma/seed-diagnostic-catalog.cjs
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const LAB_MODALITY = {
  code: "LAB",
  kind: "lab_panel",
  title: { en: "Laboratory", ru: "Лаборатория", az: "Laboratoriya" },
};
const PACKAGE_MODALITY = {
  code: "PACKAGE",
  kind: "package",
  title: { en: "Check-up packages", ru: "Пакеты чек-апов", az: "Check-up paketləri" },
};
const VISIT_MODALITY = {
  code: "VISIT",
  kind: "visit",
  title: { en: "Visit templates", ru: "Шаблоны приёма", az: "Qəbul şablonları" },
};

function loadCatalog() {
  const catalogPath = path.join(__dirname, "seed-data", "diagnostic-lab-catalog.json");
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

async function upsertModality(def, sortOrder) {
  return prisma.modality.upsert({
    where: { code: def.code },
    create: {
      code: def.code,
      kind: def.kind,
      titleEn: def.title.en,
      titleRu: def.title.ru,
      titleAz: def.title.az,
      sortOrder,
    },
    update: {
      kind: def.kind,
      titleEn: def.title.en,
      titleRu: def.title.ru,
      titleAz: def.title.az,
      sortOrder,
    },
  });
}

async function upsertService(input) {
  const data = {
    modalityId: input.modalityId,
    category: input.category ?? "",
    kind: input.kind,
    titleEn: input.title.en,
    titleRu: input.title.ru,
    titleAz: input.title.az,
    serviceCode: input.serviceCode,
    fieldsJson: input.fields ? JSON.stringify(input.fields) : null,
    includesJson: input.includes ? JSON.stringify(input.includes) : null,
    sortOrder: input.sortOrder,
  };
  return prisma.diagnosticService.upsert({
    where: { code: input.code },
    create: { code: input.code, ...data },
    update: data,
  });
}

async function upsertAnalyte(serviceId, analyte, sortOrder) {
  const data = {
    unit: analyte.unit ?? null,
    labelEn: analyte.label.en,
    labelRu: analyte.label.ru,
    labelAz: analyte.label.az,
    refMin: analyte.refMin ?? null,
    refMax: analyte.refMax ?? null,
    sortOrder,
  };
  return prisma.diagnosticAnalyte.upsert({
    where: { serviceId_code: { serviceId, code: analyte.code } },
    create: { serviceId, code: analyte.code, ...data },
    update: data,
  });
}

async function upsertMetaField(field, sortOrder) {
  const data = {
    fieldType: field.type,
    labelEn: field.label.en,
    labelRu: field.label.ru,
    labelAz: field.label.az,
    unit: field.unit ?? null,
    optionsJson: field.options ? JSON.stringify(field.options) : null,
    required: field.required ?? false,
    sortOrder,
  };
  return prisma.diagnosticMetaField.upsert({
    where: { key: field.key },
    create: { key: field.key, ...data },
    update: data,
  });
}

async function main() {
  const raw = loadCatalog();
  const counts = {
    modalities: 0,
    services: 0,
    analytes: 0,
    metaFields: 0,
    byKind: {},
  };

  function bump(kind) {
    counts.byKind[kind] = (counts.byKind[kind] || 0) + 1;
    counts.services += 1;
  }

  let modalitySort = 0;

  for (const modality of raw.modalities) {
    const modRow = await upsertModality(
      { code: modality.code, kind: modality.kind, title: modality.title },
      modalitySort++,
    );
    counts.modalities += 1;

    let serviceSort = 0;
    for (const tpl of modality.templates) {
      await upsertService({
        code: tpl.code,
        modalityId: modRow.id,
        category: tpl.category,
        kind: modality.kind,
        title: tpl.title,
        serviceCode: tpl.serviceCode ?? tpl.code,
        fields: tpl.fields,
        sortOrder: serviceSort++,
      });
      bump(modality.kind);
    }
  }

  const labModRow = await upsertModality(LAB_MODALITY, modalitySort++);
  counts.modalities += 1;
  let labSort = 0;
  for (const panel of raw.labPanels ?? []) {
    const svcRow = await upsertService({
      code: panel.code,
      modalityId: labModRow.id,
      category: panel.category,
      kind: "lab_panel",
      title: panel.title,
      serviceCode: panel.serviceCode ?? panel.code,
      sortOrder: labSort++,
    });
    bump("lab_panel");

    let analyteSort = 0;
    for (const analyte of panel.analytes ?? []) {
      await upsertAnalyte(svcRow.id, analyte, analyteSort++);
      counts.analytes += 1;
    }
  }

  const pkgModRow = await upsertModality(PACKAGE_MODALITY, modalitySort++);
  counts.modalities += 1;
  let pkgSort = 0;
  for (const pkg of raw.packages ?? []) {
    await upsertService({
      code: pkg.code,
      modalityId: pkgModRow.id,
      category: "checkup",
      kind: "package",
      title: pkg.title,
      serviceCode: pkg.code,
      includes: pkg.includes,
      sortOrder: pkgSort++,
    });
    bump("package");
  }

  const visitModRow = await upsertModality(VISIT_MODALITY, modalitySort++);
  counts.modalities += 1;
  let visitSort = 0;
  for (const visit of raw.visitTemplates ?? []) {
    await upsertService({
      code: visit.code,
      modalityId: visitModRow.id,
      category: visit.specialty,
      kind: "visit",
      title: visit.title,
      serviceCode: visit.code,
      fields: visit.fields,
      sortOrder: visitSort++,
    });
    bump("visit");
  }

  let metaSort = 0;
  for (const field of raw.commonMetaFields ?? []) {
    await upsertMetaField(field, metaSort++);
    counts.metaFields += 1;
  }

  console.log(
    "[seed-diagnostic-catalog] modalities=" +
      counts.modalities +
      " services=" +
      counts.services +
      " byKind=" +
      JSON.stringify(counts.byKind) +
      " analytes=" +
      counts.analytes +
      " metaFields=" +
      counts.metaFields,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
