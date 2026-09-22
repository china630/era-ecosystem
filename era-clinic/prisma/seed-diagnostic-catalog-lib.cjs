/**
 * Diagnostic catalog seed helpers (no CLI side effects).
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
const fs = require("fs");
const path = require("path");

function requireSeedOrgId() {
  const id =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org") {
    throw new Error(
      "ERA_SATELLITE_ORGANIZATION_ID (or ORGANIZATION_ID) required for org overlay seed; demo-org is forbidden",
    );
  }
  return id;
}

/** @deprecated use requireSeedOrgId */
function seedOrgId() {
  return requireSeedOrgId();
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

function loadCatalogCodeCanonMap() {
  return loadJson("catalog-code-canon.map.json");
}

async function remapExact(delegate, field, oldCode, newCode) {
  try {
    const r = await delegate.updateMany({
      where: { [field]: oldCode },
      data: { [field]: newCode },
    });
    return r.count;
  } catch (e) {
    if (e && e.code === "P2002") return 0;
    throw e;
  }
}

/**
 * Rename pre-canon DiagnosticService / ServiceCatalogCache / operational SKU strings
 * (ECG-12 → CARDIO-ECG, GYN-VISIT → VISIT-GYN, …) before JSON upsert so we do not
 * duplicate rows. Map: prisma/seed-data/catalog-code-canon.map.json.
 */
async function applyCatalogCodeCanon(prisma, organizationId = seedOrgId()) {
  const map = loadCatalogCodeCanonMap();
  const entries = Object.entries(map).filter(([from, to]) => from && to && from !== to);
  const counts = {
    diagnosticRenamed: 0,
    diagnosticMerged: 0,
    cacheRenamed: 0,
    cacheMerged: 0,
    includesRewritten: 0,
    skuRows: 0,
  };

  for (const [from, to] of entries) {
    const oldSvc = await prisma.diagnosticService.findUnique({
      where: { organizationId_code: { organizationId, code: from } },
    });
    const newSvc = await prisma.diagnosticService.findUnique({
      where: { organizationId_code: { organizationId, code: to } },
    });
    if (oldSvc && !newSvc) {
      await prisma.diagnosticService.update({
        where: { id: oldSvc.id },
        data: {
          code: to,
          serviceCode: oldSvc.serviceCode === from ? to : map[oldSvc.serviceCode] || oldSvc.serviceCode,
        },
      });
      counts.diagnosticRenamed += 1;
    } else if (oldSvc && newSvc) {
      await prisma.labOrderItem.updateMany({
        where: { diagnosticServiceId: oldSvc.id },
        data: { diagnosticServiceId: newSvc.id },
      });
      await prisma.diagnosticService.update({
        where: { id: oldSvc.id },
        data: { active: false },
      });
      counts.diagnosticMerged += 1;
    }

    const oldCache = await prisma.serviceCatalogCache.findUnique({
      where: { organizationId_code: { organizationId, code: from } },
    });
    const newCache = await prisma.serviceCatalogCache.findUnique({
      where: { organizationId_code: { organizationId, code: to } },
    });
    if (oldCache && !newCache) {
      await prisma.serviceCatalogCache.update({
        where: { id: oldCache.id },
        data: { code: to },
      });
      counts.cacheRenamed += 1;
    } else if (oldCache && newCache) {
      const oldAmt = Number(oldCache.amount);
      const newAmt = Number(newCache.amount);
      const patch = {};
      if (newAmt === 0 && oldAmt > 0) {
        patch.amount = oldCache.amount;
        if (newCache.listAmount == null && oldCache.listAmount != null) {
          patch.listAmount = oldCache.listAmount;
        }
      }
      if (Object.keys(patch).length) {
        await prisma.serviceCatalogCache.update({
          where: { id: newCache.id },
          data: patch,
        });
      }
      await prisma.serviceCatalogCache.delete({ where: { id: oldCache.id } });
      counts.cacheMerged += 1;
    }

    counts.skuRows += await remapExact(prisma.labOrder, "testCode", from, to);
    counts.skuRows += await remapExact(prisma.labOrderItem, "serviceCode", from, to);
    counts.skuRows += await remapExact(prisma.labOrderItem, "packageQuotaCode", from, to);
    counts.skuRows += await remapExact(prisma.visitServiceLine, "serviceCode", from, to);
    counts.skuRows += await remapExact(prisma.visitServiceLine, "packageQuotaCode", from, to);
    counts.skuRows += await remapExact(prisma.clinicReceiptLine, "serviceCode", from, to);
    counts.skuRows += await remapExact(prisma.procedureOrder, "procedureCode", from, to);
    counts.skuRows += await remapExact(prisma.procedureChargeLog, "procedureCode", from, to);
    counts.skuRows += await remapExact(prisma.programTemplateProcedure, "procedureCode", from, to);
    counts.skuRows += await remapExact(prisma.programTemplateQuotaKnot, "procedureCode", from, to);
    counts.skuRows += await remapExact(prisma.programTemplateBlockMember, "procedureCode", from, to);
    counts.skuRows += await remapExact(prisma.programProcedureBalance, "procedureCode", from, to);
  }

  const withIncludes = await prisma.diagnosticService.findMany({
    where: { organizationId, includesJson: { not: null } },
    select: { id: true, includesJson: true },
  });
  for (const row of withIncludes) {
    let arr;
    try {
      arr = JSON.parse(row.includesJson);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    const next = arr.map((c) => (typeof c === "string" && map[c]) || c);
    if (JSON.stringify(next) !== JSON.stringify(arr)) {
      await prisma.diagnosticService.update({
        where: { id: row.id },
        data: { includesJson: JSON.stringify(next) },
      });
      counts.includesRewritten += 1;
    }
  }

  console.log("[catalog-code-canon] apply", organizationId, JSON.stringify(counts));
  return counts;
}

async function upsertModalityOrg(prisma, organizationId, def, sortOrder) {
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

async function upsertServiceOrg(prisma, organizationId, input) {
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

async function upsertAnalyteOrg(prisma, serviceId, analyte, sortOrder) {
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

async function upsertModalityTemplate(prisma, def, sortOrder) {
  return prisma.modalityTemplate.upsert({
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

async function upsertServiceTemplate(prisma, input) {
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
  return prisma.diagnosticServiceTemplate.upsert({
    where: { code: input.code },
    create: { code: input.code, ...data },
    update: data,
  });
}

async function upsertAnalyteTemplate(prisma, serviceId, analyte, sortOrder) {
  const data = {
    unit: analyte.unit ?? null,
    labelEn: analyte.label.en,
    labelRu: analyte.label.ru,
    labelAz: analyte.label.az,
    refMin: analyte.refMin ?? null,
    refMax: analyte.refMax ?? null,
    sortOrder,
  };
  return prisma.diagnosticAnalyteTemplate.upsert({
    where: { serviceId_code: { serviceId, code: analyte.code } },
    create: { serviceId, code: analyte.code, ...data },
    update: data,
  });
}

/** Copy-if-empty templates → org (CJS path for Nafta seed). */
async function copyDiagnosticTemplatesToOrg(prisma, organizationId) {
  const templates = await prisma.modalityTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { analytes: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  for (const mt of templates) {
    let modality = await prisma.modality.findUnique({
      where: { organizationId_code: { organizationId, code: mt.code } },
    });
    if (!modality) {
      modality = await prisma.modality.create({
        data: {
          organizationId,
          code: mt.code,
          kind: mt.kind,
          titleEn: mt.titleEn,
          titleRu: mt.titleRu,
          titleAz: mt.titleAz,
          sortOrder: mt.sortOrder,
          active: mt.active,
        },
      });
    }
    for (const st of mt.services) {
      let service = await prisma.diagnosticService.findUnique({
        where: { organizationId_code: { organizationId, code: st.code } },
      });
      if (!service) {
        service = await prisma.diagnosticService.create({
          data: {
            organizationId,
            code: st.code,
            modalityId: modality.id,
            category: st.category,
            kind: st.kind,
            titleEn: st.titleEn,
            titleRu: st.titleRu,
            titleAz: st.titleAz,
            serviceCode: st.serviceCode,
            fieldsJson: st.fieldsJson,
            includesJson: st.includesJson,
            sortOrder: st.sortOrder,
            active: st.active,
          },
        });
      }
      for (const at of st.analytes) {
        const existingA = await prisma.diagnosticAnalyte.findUnique({
          where: { serviceId_code: { serviceId: service.id, code: at.code } },
        });
        if (existingA) continue;
        await prisma.diagnosticAnalyte.create({
          data: {
            serviceId: service.id,
            code: at.code,
            unit: at.unit,
            labelEn: at.labelEn,
            labelRu: at.labelRu,
            labelAz: at.labelAz,
            refMin: at.refMin,
            refMax: at.refMax,
            section: at.section,
            valueType: at.valueType,
            sortOrder: at.sortOrder,
          },
        });
      }
    }
  }
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

/** Satellite base → unscoped modality / service / analyte templates + meta fields. */
async function seedDiagnosticBase(prisma) {
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
    const modRow = await upsertModalityTemplate(
      prisma,
      { code: modality.code, kind: modality.kind, title: modality.title },
      modalitySort++,
    );
    counts.modalities += 1;

    let serviceSort = 0;
    for (const tpl of modality.templates || []) {
      await upsertServiceTemplate(prisma, {
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

  const labModRow = await upsertModalityTemplate(prisma, LAB_MODALITY, modalitySort++);
  counts.modalities += 1;
  let labSort = 0;
  for (const panel of raw.labPanels ?? []) {
    const svcRow = await upsertServiceTemplate(prisma, {
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
      await upsertAnalyteTemplate(prisma, svcRow.id, analyte, analyteSort++);
      counts.analytes += 1;
    }
  }

  const pkgModRow = await upsertModalityTemplate(prisma, PACKAGE_MODALITY, modalitySort++);
  counts.modalities += 1;
  let pkgSort = 0;
  for (const pkg of raw.packages ?? []) {
    await upsertServiceTemplate(prisma, {
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

  const visitModRow = await upsertModalityTemplate(prisma, VISIT_MODALITY, modalitySort++);
  counts.modalities += 1;
  let visitSort = 0;
  for (const visit of raw.visitTemplates ?? []) {
    await upsertServiceTemplate(prisma, {
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

  return { layer: "base", ...counts };
}

async function seedDiagnosticNafta(prisma, organizationId = requireSeedOrgId()) {
  await applyCatalogCodeCanon(prisma, organizationId);
  await copyDiagnosticTemplatesToOrg(prisma, organizationId);

  const overlay = loadJson("nafta", "diagnostic-overlay.json");
  const counts = { packages: 0, servicePatches: 0 };

  const pkgMod = await prisma.modality.findUnique({
    where: { organizationId_code: { organizationId, code: "PACKAGE" } },
  });
  if (!pkgMod) {
    throw new Error("[seed-diagnostic-nafta] PACKAGE modality missing — run db:seed templates first");
  }

  let pkgSort = 900;
  for (const pkg of overlay.packages ?? []) {
    await upsertServiceOrg(prisma, organizationId, {
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
  requireSeedOrgId,
  loadCatalogCodeCanonMap,
  applyCatalogCodeCanon,
  seedDiagnosticBase,
  seedDiagnosticNafta,
  copyDiagnosticTemplatesToOrg,
};
