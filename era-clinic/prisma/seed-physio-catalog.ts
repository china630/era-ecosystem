/**
 * Idempotent seed: physio S zones + device programs / substances + type gates.
 * Source: prisma/seed-data/nafta/physio-zones-s.json + physio-list-items.json
 * Type gates: inferPhysioTypeGate(code, name) overwrites needsSite / physioOrderFields.
 * Run: npx tsx prisma/seed-physio-catalog.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type PhysioListKind } from "@prisma/client";
import {
  mapPhysioListSeeds,
  mapPhysioZoneSeeds,
  type PhysioListItemSeedJson,
  type PhysioZoneSeedJson,
} from "../src/domain/physio/physio-seed-map";
import { inferPhysioTypeGate } from "../src/domain/physio/physio-type-gate";

const prisma = new PrismaClient();

function orgId(): string {
  return (
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "demo-org"
  );
}

function loadJson<T>(rel: string): T {
  const p = join(__dirname, "seed-data", "nafta", rel);
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

async function main() {
  const organizationId = orgId();
  const zonesFile = loadJson<{ zones: PhysioZoneSeedJson[] }>("physio-zones-s.json");
  const listsFile = loadJson<{ items: PhysioListItemSeedJson[] }>("physio-list-items.json");
  const { sites, skippedAliases } = mapPhysioZoneSeeds(zonesFile.zones ?? []);
  const listItems = mapPhysioListSeeds(listsFile.items ?? []);

  for (const site of sites) {
    const row = await prisma.physioSite.upsert({
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
    await prisma.physioSiteAlias.deleteMany({ where: { siteId: row.id } });
    if (site.aliases.length) {
      await prisma.physioSiteAlias.createMany({
        data: site.aliases.map((alias) => ({
          organizationId,
          siteId: row.id,
          alias,
        })),
        skipDuplicates: true,
      });
    }
  }

  for (const item of listItems) {
    const listKind = item.listKind as PhysioListKind;
    const row = await prisma.physioListItem.upsert({
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
    await prisma.physioListAlias.deleteMany({ where: { itemId: row.id } });
    if (item.aliases.length) {
      await prisma.physioListAlias.createMany({
        data: item.aliases.map((alias) => ({
          organizationId,
          itemId: row.id,
          listKind,
          alias,
        })),
        skipDuplicates: true,
      });
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
      data: { needsSite: gate.needsSite, physioOrderFields: gate.fields },
    });
  }

  console.log(
    JSON.stringify({
      organizationId,
      sites: sites.length,
      listItems: listItems.length,
      skippedAliases: skippedAliases.length,
      typeGates: types.length,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
