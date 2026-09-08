/**
 * Physio catalog seed helpers (no CLI side effects).
 * ADR: docs/adr/clinic-catalog-base-and-org-overlay-seeds.md
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

export function seedOrgId(): string {
  return (
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "demo-org"
  );
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

export async function seedPhysioBase(
  prisma: PrismaClient,
  organizationId = seedOrgId(),
) {
  const zonesFile = loadJson<{ zones: PhysioZoneSeedJson[] }>("base", "physio-zones-s.json");
  const listsFile = loadJson<{ items: PhysioListItemSeedJson[] }>("base", "physio-list-items.json");
  const { sites, skippedAliases } = mapPhysioZoneSeeds(zonesFile.zones ?? []);
  const listItems = mapPhysioListSeeds(listsFile.items ?? []);

  for (const site of sites) {
    await prisma.physioSite.upsert({
      where: { organizationId_code: { organizationId, code: site.code } },
      create: {
        organizationId,
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
    await prisma.physioListItem.upsert({
      where: {
        organizationId_listKind_code: {
          organizationId,
          listKind,
          code: item.code,
        },
      },
      create: {
        organizationId,
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
    organizationId,
    layer: "base" as const,
    sites: sites.length,
    listItems: listItems.length,
    skippedAliases: skippedAliases.length,
  };
}

export async function seedPhysioNafta(
  prisma: PrismaClient,
  organizationId = seedOrgId(),
) {
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
      console.warn(`[seed-physio-nafta] missing base site ${code} — run base seed first`);
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
