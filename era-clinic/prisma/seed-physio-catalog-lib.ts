/**
 * Physio catalog seed helpers (no CLI side effects).
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type PhysioListKind } from "@prisma/client";
import { normalizePhysioAlias } from "../src/domain/physio/physio-catalog";
import {
  mapPhysioListSeeds,
  mapPhysioZoneSeeds,
  type PhysioListItemSeedJson,
  type PhysioZoneSeedJson,
} from "../src/domain/physio/physio-seed-map";
import { inferPhysioTypeGate } from "../src/domain/physio/physio-type-gate";
import { ensureClinicCatalogFromTemplates } from "../src/domain/catalog/ensure-clinic-catalog-from-templates";

/** Org overlay / Nafta seeds only — never demo-org. */
export function requireSeedOrgId(): string {
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

/** @deprecated use requireSeedOrgId — kept for call sites that expect seedOrgId name */
export function seedOrgId(): string {
  return requireSeedOrgId();
}

function loadJson<T>(...parts: string[]): T {
  const p = join(__dirname, "seed-data", ...parts);
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

function uniqueAliases(raw: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw ?? []) {
    const alias = normalizePhysioAlias(item);
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    out.push(alias);
  }
  return out;
}

/** Satellite base → unscoped PhysioSiteTemplate / PhysioListItemTemplate. */
export async function seedPhysioBase(prisma: PrismaClient) {
  const zonesFile = loadJson<{ zones: PhysioZoneSeedJson[] }>("base", "physio-zones-s.json");
  const listsFile = loadJson<{ items: PhysioListItemSeedJson[] }>("base", "physio-list-items.json");
  const { sites, skippedAliases } = mapPhysioZoneSeeds(zonesFile.zones ?? []);
  const listItems = mapPhysioListSeeds(listsFile.items ?? []);

  for (const site of sites) {
    await prisma.physioSiteTemplate.upsert({
      where: { code: site.code },
      create: {
        code: site.code,
        kind: site.kind,
        prikaz817: site.prikaz817,
        laterality: site.laterality,
        titleAz: site.titleAz,
        titleRu: site.titleRu,
        titleEn: site.titleEn,
        titleLa: site.titleLa,
        boundary: site.boundary,
        coarse: site.coarse,
        anatomyJson: site.anatomyJson,
        sortOrder: site.sortOrder,
      },
      update: {
        kind: site.kind,
        prikaz817: site.prikaz817,
        laterality: site.laterality,
        titleAz: site.titleAz,
        titleRu: site.titleRu,
        titleEn: site.titleEn,
        titleLa: site.titleLa,
        boundary: site.boundary,
        coarse: site.coarse,
        anatomyJson: site.anatomyJson,
        sortOrder: site.sortOrder,
      },
    });
  }

  for (const item of listItems) {
    const listKind = item.listKind as PhysioListKind;
    await prisma.physioListItemTemplate.upsert({
      where: { listKind_code: { listKind, code: item.code } },
      create: {
        listKind,
        code: item.code,
        titleAz: item.titleAz,
        titleRu: item.titleRu,
        titleEn: item.titleEn,
        sortOrder: item.sortOrder,
      },
      update: {
        titleAz: item.titleAz,
        titleRu: item.titleRu,
        titleEn: item.titleEn,
        sortOrder: item.sortOrder,
      },
    });
  }

  return {
    layer: "base" as const,
    sites: sites.length,
    listItems: listItems.length,
    skippedAliases: skippedAliases.length,
  };
}

/**
 * Nafta org overlay (aliases + type gates). Requires bound org.
 * Ensures org overlay rows exist via copy-if-empty before applying aliases.
 */
export async function seedPhysioNafta(
  prisma: PrismaClient,
  organizationId = requireSeedOrgId(),
) {
  await ensureClinicCatalogFromTemplates(prisma, organizationId);

  const zonesOverlay = loadJson<{
    siteAliases?: Array<{ code: string; woAliases?: string[] }>;
  }>("nafta", "physio-zones-overlay.json");
  const listOverlay = loadJson<{
    itemAliases?: Array<{ listKind: string; code: string; aliases?: string[] }>;
  }>("nafta", "physio-list-overlay.json");

  let siteAliasRows = 0;
  for (const entry of zonesOverlay.siteAliases ?? []) {
    const code = entry.code.trim().toUpperCase();
    const site = await prisma.physioSite.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
    if (!site) {
      console.warn(`[seed-physio-nafta] missing base site ${code} — run db:seed templates first`);
      continue;
    }
    const aliases = uniqueAliases(entry.woAliases);
    await prisma.physioSiteAlias.deleteMany({ where: { siteId: site.id } });
    if (aliases.length) {
      await prisma.physioSiteAlias.createMany({
        data: aliases.map((alias) => ({
          organizationId,
          siteId: site.id,
          alias,
        })),
        skipDuplicates: true,
      });
      siteAliasRows += aliases.length;
    }
  }

  let listAliasRows = 0;
  for (const entry of listOverlay.itemAliases ?? []) {
    const listKind = entry.listKind as PhysioListKind;
    const code = entry.code.trim().toUpperCase();
    const item = await prisma.physioListItem.findUnique({
      where: {
        organizationId_listKind_code: { organizationId, listKind, code },
      },
    });
    if (!item) {
      console.warn(`[seed-physio-nafta] missing base list item ${listKind}/${code}`);
      continue;
    }
    const aliases = uniqueAliases(entry.aliases);
    await prisma.physioListAlias.deleteMany({ where: { itemId: item.id } });
    if (aliases.length) {
      await prisma.physioListAlias.createMany({
        data: aliases.map((alias) => ({
          organizationId,
          itemId: item.id,
          listKind,
          alias,
        })),
        skipDuplicates: true,
      });
      listAliasRows += aliases.length;
    }
  }

  const types = await prisma.procedureType.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true },
  });
  for (const row of types) {
    const gate = inferPhysioTypeGate(row.code, row.name);
    await prisma.procedureType.update({
      where: { id: row.id },
      data: {
        needsSite: gate.needsSite,
        physioOrderFields: gate.fields,
        allowedSiteCodes: gate.allowedSiteCodes,
      },
    });
  }

  return {
    organizationId,
    layer: "nafta" as const,
    siteAliasRows,
    listAliasRows,
    typeGates: types.length,
  };
}
