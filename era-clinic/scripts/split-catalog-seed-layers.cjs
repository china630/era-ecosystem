/**
 * One-shot (idempotent) split: physio-zones-s.json + physio-list-items.json
 * → base (no WO aliases) + nafta overlay. Leaves a merge-compatible overlay.
 *
 *   node era-clinic/scripts/split-catalog-seed-layers.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../prisma/seed-data");
const NAFTA = path.join(ROOT, "nafta");
const BASE = path.join(ROOT, "base");

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", path.relative(process.cwd(), file));
}

function splitPhysioZones() {
  const srcPath = path.join(NAFTA, "physio-zones-s.json");
  const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));

  const baseZones = (src.zones || []).map((z) => {
    const { woAliases, ...rest } = z;
    return { ...rest, woAliases: [] };
  });

  const base = {
    id: "physio-zones-s-base",
    layer: "base",
    notProductSoR: true,
    sources: src.sources,
    notes: [
      "Satellite base: CIS spa S codes (817 / Shcherbak / hydro). No WO aliases.",
      "Nafta WO aliases + matcher extras: prisma/seed-data/nafta/physio-zones-overlay.json",
      "Canon: era-clinic/doc/physio-site-canon.md",
    ],
    zones: baseZones,
  };

  const siteAliases = (src.zones || [])
    .filter((z) => Array.isArray(z.woAliases) && z.woAliases.length)
    .map((z) => ({ code: z.code, woAliases: z.woAliases }));

  const overlay = {
    id: "physio-zones-s-nafta-overlay",
    layer: "nafta",
    notProductSoR: true,
    notes: [
      "Org overlay for Nafta: WO aliases + offline matcher extras.",
      "Merge with base via src/domain/physio/physio-catalog-layers.ts (or .cjs twin).",
    ],
    siteAliases,
    orderFieldsNotZones: src.orderFieldsNotZones ?? [],
    closedDecisions: src.closedDecisions ?? [],
    matchRules: src.matchRules ?? {},
    compositeMaps: src.compositeMaps ?? [],
    naftaResourceSketch: src.naftaResourceSketch ?? null,
  };

  writeJson(path.join(BASE, "physio-zones-s.json"), base);
  writeJson(path.join(NAFTA, "physio-zones-overlay.json"), overlay);

  // Keep physio-zones-s.json as merged view for older scripts until they switch to merge helper.
  const merged = mergeZones(base, overlay);
  writeJson(srcPath, merged);
}

function mergeZones(base, overlay) {
  const aliasByCode = new Map(
    (overlay.siteAliases || []).map((a) => [a.code, a.woAliases || []]),
  );
  return {
    id: "physio-zones-s-merged",
    layer: "merged",
    notProductSoR: true,
    sources: base.sources,
    notes: [
      ...(base.notes || []),
      "Merged base + nafta overlay (generated). Prefer loading via merge helper.",
    ],
    orderFieldsNotZones: overlay.orderFieldsNotZones ?? [],
    zones: (base.zones || []).map((z) => ({
      ...z,
      woAliases: aliasByCode.get(z.code) || [],
    })),
    closedDecisions: overlay.closedDecisions ?? [],
    matchRules: overlay.matchRules ?? {},
    compositeMaps: overlay.compositeMaps ?? [],
    naftaResourceSketch: overlay.naftaResourceSketch ?? null,
  };
}

function splitPhysioLists() {
  const srcPath = path.join(NAFTA, "physio-list-items.json");
  const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));

  const baseItems = (src.items || []).map((it) => {
    const { aliases, ...rest } = it;
    return { ...rest, aliases: [] };
  });

  const itemAliases = (src.items || [])
    .filter((it) => Array.isArray(it.aliases) && it.aliases.length)
    .map((it) => ({
      listKind: it.listKind,
      code: it.code,
      aliases: it.aliases,
    }));

  writeJson(path.join(BASE, "physio-list-items.json"), {
    id: "physio-list-items-base",
    layer: "base",
    notProductSoR: true,
    notes: [
      "Satellite base DEVICE_PROGRAM / SUBSTANCE codes. Aliases live in Nafta overlay.",
    ],
    items: baseItems,
  });

  writeJson(path.join(NAFTA, "physio-list-overlay.json"), {
    id: "physio-list-items-nafta-overlay",
    layer: "nafta",
    notProductSoR: true,
    notes: ["WO / reception aliases for physio list items."],
    itemAliases,
  });

  // Keep original list file as merged (codes + aliases) for any direct readers.
  writeJson(srcPath, {
    id: "physio-list-items-merged",
    layer: "merged",
    notProductSoR: true,
    notes: src.notes,
    items: (src.items || []).map((it) => ({
      ...it,
      aliases: itemAliases.find((a) => a.listKind === it.listKind && a.code === it.code)?.aliases || it.aliases || [],
    })),
  });
}

function splitDiagnostic() {
  const srcPath = path.join(ROOT, "diagnostic-lab-catalog.json");
  const overlayPath = path.join(NAFTA, "diagnostic-overlay.json");
  const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const prevOverlay = fs.existsSync(overlayPath)
    ? JSON.parse(fs.readFileSync(overlayPath, "utf8"))
    : null;

  const SOURCE_NOTE = {
    key: "sourceNote",
    type: "textarea",
    label: {
      en: "Original note (WO Qeyd)",
      ru: "Исходный текст (WO Qeyd)",
      az: "Orijinal qeyd (WO)",
    },
  };

  const naftaAbdTitle = {
    en: "Abdominal + pelvic ultrasound (Nafta)",
    ru: "УЗИ живота и малого таза (Nafta)",
    az: "Qarın boşluğu və kiçik çanaq USM",
  };
  const baseAbdTitle = {
    en: "Abdominal ultrasound",
    ru: "УЗИ органов брюшной полости",
    az: "Qarın boşluğu USM",
  };

  const servicePatches = [];
  const packages = [];
  const basePackages = [];

  for (const pkg of src.packages || []) {
    if (pkg.code === "PKG-NAFTA-INTAKE") packages.push(pkg);
    else basePackages.push(pkg);
  }
  if (!packages.length && prevOverlay?.packages?.length) {
    packages.push(...prevOverlay.packages);
  }

  for (const modality of src.modalities || []) {
    for (const tpl of modality.templates || []) {
      if (!String(tpl.code || "").startsWith("USG")) continue;
      const fields = Array.isArray(tpl.fields) ? tpl.fields : [];
      const withoutNote = fields.filter((f) => f.key !== "sourceNote");
      const hadNote = withoutNote.length !== fields.length;

      if (tpl.code === "USG-ABD") {
        const fromPrev = (prevOverlay?.servicePatches || []).find((p) => p.code === "USG-ABD");
        const naftaFields = fields.some((f) => f.key === "sourceNote")
          ? fields
          : fromPrev?.fields || [...withoutNote, SOURCE_NOTE];
        servicePatches.push({
          code: "USG-ABD",
          title: naftaAbdTitle,
          fields: naftaFields,
        });
        tpl.title = baseAbdTitle;
        tpl.fields = withoutNote;
      } else if (hadNote) {
        servicePatches.push({
          code: tpl.code,
          fieldsAppend: [SOURCE_NOTE],
        });
        tpl.fields = withoutNote;
      } else if (prevOverlay?.servicePatches?.some((p) => p.code === tpl.code)) {
        const prev = prevOverlay.servicePatches.find((p) => p.code === tpl.code);
        servicePatches.push(prev);
      }
    }
  }

  src.packages = basePackages;
  src.layer = "base";
  src.notes = [
    "Base diagnostic catalog (satellite bootstrap). Nafta package/USG patches: nafta/diagnostic-overlay.json",
  ];

  writeJson(srcPath, src);
  writeJson(overlayPath, {
    id: "diagnostic-nafta-overlay",
    layer: "nafta",
    notProductSoR: true,
    notes: [
      "Org overlay: check-in package + Nafta USG form patches (WO sourceNote).",
      "Apply after seed-diagnostic-catalog base.",
    ],
    packages,
    servicePatches,
  });
}

splitPhysioZones();
splitPhysioLists();
splitDiagnostic();
console.log("done");
