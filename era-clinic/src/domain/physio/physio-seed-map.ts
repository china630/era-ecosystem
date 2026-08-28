import { normalizePhysioAlias, parseSiteKind } from "./physio-catalog";

export type PhysioZoneSeedJson = {
  code: string;
  kind: string;
  prikaz817?: number | null;
  laterality?: boolean;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  boundary?: string | null;
  coarse: string[];
  anatomy?: unknown;
  woAliases?: string[];
};

export type PhysioListItemSeedJson = {
  listKind: "DEVICE_PROGRAM" | "SUBSTANCE";
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  sortOrder?: number;
  aliases?: string[];
};

export type MappedPhysioSiteSeed = {
  code: string;
  kind: string;
  prikaz817: number | null;
  laterality: boolean;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  boundary: string | null;
  coarse: string[];
  anatomyJson: string | null;
  sortOrder: number;
  aliases: string[];
};

export type MappedPhysioListSeed = {
  listKind: "DEVICE_PROGRAM" | "SUBSTANCE";
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  sortOrder: number;
  aliases: string[];
};

export type AliasSkip = { alias: string; fromCode: string; keptCode: string };

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

/**
 * Map seed JSON zones → rows. First zone keeps a colliding alias (matcher greedy).
 */
export function mapPhysioZoneSeeds(
  zones: PhysioZoneSeedJson[],
): { sites: MappedPhysioSiteSeed[]; skippedAliases: AliasSkip[] } {
  const owner = new Map<string, string>();
  const skippedAliases: AliasSkip[] = [];
  const sites: MappedPhysioSiteSeed[] = [];

  zones.forEach((zone, index) => {
    const kind = parseSiteKind(zone.kind);
    const aliases: string[] = [];
    for (const alias of uniqueAliases(zone.woAliases)) {
      const kept = owner.get(alias);
      if (kept && kept !== zone.code) {
        skippedAliases.push({ alias, fromCode: zone.code, keptCode: kept });
        continue;
      }
      owner.set(alias, zone.code);
      aliases.push(alias);
    }
    sites.push({
      code: zone.code.trim().toUpperCase(),
      kind,
      prikaz817: zone.prikaz817 ?? null,
      laterality: Boolean(zone.laterality),
      titleAz: zone.titleAz.trim(),
      titleRu: zone.titleRu.trim(),
      titleEn: zone.titleEn.trim(),
      titleLa: zone.titleLa.trim(),
      boundary: zone.boundary?.trim() || null,
      coarse: zone.coarse.map((c) => c.trim().toUpperCase()).filter(Boolean),
      anatomyJson: zone.anatomy ? JSON.stringify(zone.anatomy) : null,
      sortOrder: zone.prikaz817 ?? (index + 1) * 10,
      aliases,
    });
  });

  return { sites, skippedAliases };
}

export function mapPhysioListSeeds(items: PhysioListItemSeedJson[]): MappedPhysioListSeed[] {
  const owner = new Map<string, string>();
  const out: MappedPhysioListSeed[] = [];
  items.forEach((item, index) => {
    const aliases: string[] = [];
    const keyPrefix = `${item.listKind}:`;
    for (const alias of uniqueAliases(item.aliases)) {
      const k = keyPrefix + alias;
      if (owner.has(k)) continue;
      owner.set(k, item.code);
      aliases.push(alias);
    }
    out.push({
      listKind: item.listKind,
      code: item.code.trim().toUpperCase(),
      titleAz: item.titleAz.trim(),
      titleRu: item.titleRu.trim(),
      titleEn: item.titleEn.trim(),
      sortOrder: item.sortOrder ?? (index + 1) * 10,
      aliases,
    });
  });
  return out;
}
