/**
 * Diagnostic catalog seed helpers (no CLI side effects).
 * ADR: docs/adr/clinic-catalog-base-and-org-overlay-seeds.md
 */
const fs = require("fs");
const path = require("path");

function seedOrgId() {
  return (
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "demo-org"
  );
}

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

function loadJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data", ...parts), "utf8"));
}

async function upsertModality(prisma, organizationId, def, sortOrder) {
  return prisma.modality.upsert({
    where: { organizationId_code: { organizationId, code: def.code } },
    create: {
      organizationId,
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

async function upsertService(prisma, organizationId, input) {
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
    where: { organizationId_code: { organizationId, code: input.code } },
    create: { organizationId, code: input.code, ...data },
    update: data,
  });
}

async function upsertAnalyte(prisma, serviceId, analyte, sortOrder) {
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

async function upsertMetaField(prisma, field, sortOrder) {
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

async function seedDiagnosticBase(prisma, organizationId = seedOrgId()) {
  const raw = loadJson("diagnostic-lab-catalog.json");
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

  for (const modality of raw.modalities || []) {
    const modRow = await upsertModality(
      prisma,
      organizationId,
      { code: modality.code, kind: modality.kind, title: modality.title },
      modalitySort++,
    );
    counts.modalities += 1;

    let serviceSort = 0;
    for (const tpl of modality.templates || []) {
      await upsertService(prisma, organizationId, {
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

  const labModRow = await upsertModality(prisma, organizationId, LAB_MODALITY, modalitySort++);
  counts.modalities += 1;
  let labSort = 0;
  for (const panel of raw.labPanels ?? []) {
    const svcRow = await upsertService(prisma, organizationId, {
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
      await upsertAnalyte(prisma, svcRow.id, analyte, analyteSort++);
      counts.analytes += 1;
    }
  }

  const pkgModRow = await upsertModality(prisma, organizationId, PACKAGE_MODALITY, modalitySort++);
  counts.modalities += 1;
  let pkgSort = 0;
  for (const pkg of raw.packages ?? []) {
    await upsertService(prisma, organizationId, {
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

  const visitModRow = await upsertModality(prisma, organizationId, VISIT_MODALITY, modalitySort++);
  counts.modalities += 1;
  let visitSort = 0;
  for (const visit of raw.visitTemplates ?? []) {
    await upsertService(prisma, organizationId, {
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
    await upsertMetaField(prisma, field, metaSort++);
    counts.metaFields += 1;
  }

  return { organizationId, layer: "base", ...counts };
}

async function seedDiagnosticNafta(prisma, organizationId = seedOrgId()) {
  const overlay = loadJson("nafta", "diagnostic-overlay.json");
  const counts = { packages: 0, servicePatches: 0 };

  const pkgMod = await prisma.modality.findUnique({
    where: { organizationId_code: { organizationId, code: "PACKAGE" } },
  });
  if (!pkgMod) {
    throw new Error("[seed-diagnostic-nafta] PACKAGE modality missing — run base seed first");
  }

  let pkgSort = 900;
  for (const pkg of overlay.packages ?? []) {
    await upsertService(prisma, organizationId, {
      code: pkg.code,
      modalityId: pkgMod.id,
      category: "checkup",
      kind: "package",
      title: pkg.title,
      serviceCode: pkg.code,
      includes: pkg.includes,
      sortOrder: pkgSort++,
    });
    counts.packages += 1;
  }

  for (const patch of overlay.servicePatches ?? []) {
    const existing = await prisma.diagnosticService.findUnique({
      where: { organizationId_code: { organizationId, code: patch.code } },
    });
    if (!existing) {
      console.warn(`[seed-diagnostic-nafta] missing service ${patch.code}`);
      continue;
    }
    let fields = existing.fieldsJson ? JSON.parse(existing.fieldsJson) : [];
    if (Array.isArray(patch.fields)) {
      fields = patch.fields;
    } else if (Array.isArray(patch.fieldsAppend)) {
      const keys = new Set(fields.map((f) => f.key));
      for (const f of patch.fieldsAppend) {
        if (!keys.has(f.key)) fields.push(f);
      }
    }
    const data = {
      fieldsJson: fields.length ? JSON.stringify(fields) : existing.fieldsJson,
    };
    if (patch.title) {
      data.titleEn = patch.title.en;
      data.titleRu = patch.title.ru;
      data.titleAz = patch.title.az;
    }
    await prisma.diagnosticService.update({
      where: { id: existing.id },
      data,
    });
    counts.servicePatches += 1;
  }

  return { organizationId, layer: "nafta", ...counts };
}

module.exports = {
  seedOrgId,
  seedDiagnosticBase,
  seedDiagnosticNafta,
};
