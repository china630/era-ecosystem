/**
 * Map WO cutover codes/names onto Nafta seed catalog (SVC-* / CAB-*).
 * Seed owns names, encoding, duration/gap. WO owns historical slot times.
 */

export type CatalogNameRow = { code: string; name: string };

const PROCEDURE_ALIASES: Record<string, string> = {
  solyuks: "SVC-SOLLYUKS",
  sollyuks: "SVC-SOLLYUKS",
  elektroforez: "SVC-ELEKTROTERAPIYA",
  elektroterapiya: "SVC-ELEKTROTERAPIYA",
  vakumterapiya: "SVC-VAKUUMTERAPIYA",
  vakuumterapiya: "SVC-VAKUUMTERAPIYA",
  "4 kamera vanna": "SVC-4-KAMERALI-NAFTALAN-VANNASI",
  "4 kamera hidroqalvanizasiya": "SVC-4-KAMERALI-HIDROQALVANIZASIYA",
  amplipuls: "SVC-AMPLIPULS",
  aplikasiya: "SVC-NAFTALAN-VANNASI-QADIN",
};

export function normalizeCatalogName(raw: string): string {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function indexByNormName(catalog: CatalogNameRow[]): Map<string, CatalogNameRow> {
  const map = new Map<string, CatalogNameRow>();
  for (const row of catalog) {
    const key = normalizeCatalogName(row.name);
    if (key && !map.has(key)) map.set(key, row);
    const codeKey = normalizeCatalogName(row.code.replace(/^SVC-/, "").replace(/-/g, " "));
    if (codeKey && !map.has(codeKey)) map.set(codeKey, row);
  }
  return map;
}

export function matchProcedureToSeed(
  nameOrCode: string,
  catalog: CatalogNameRow[],
): CatalogNameRow | null {
  const raw = String(nameOrCode || "").trim();
  if (!raw) return null;
  const byCode = catalog.find((r) => r.code === raw);
  if (byCode) return byCode;
  const norm = normalizeCatalogName(raw.replace(/^WO-TR-\d+$/i, ""));
  if (!norm) return null;
  const aliasCode = PROCEDURE_ALIASES[norm];
  if (aliasCode) {
    const hit = catalog.find((r) => r.code === aliasCode);
    if (hit) return hit;
  }
  const byName = indexByNormName(catalog);
  return byName.get(norm) ?? null;
}

export function matchRoomToSeed(nameOrCode: string, catalog: CatalogNameRow[]): CatalogNameRow | null {
  const raw = String(nameOrCode || "").trim();
  if (!raw) return null;
  const byCode = catalog.find((r) => r.code === raw);
  if (byCode) return byCode;
  const norm = normalizeCatalogName(raw.replace(/^WO-ROOM-\d+$/i, ""));
  if (!norm) return null;
  const byName = indexByNormName(catalog);
  const exact = byName.get(norm);
  if (exact) return exact;
  const kabina = norm.match(/^kabina (\d+)$/);
  if (kabina) {
    const want = `kabina ${kabina[1]}`;
    for (const row of catalog) {
      const n = normalizeCatalogName(row.name);
      if (n === want || n.startsWith(`${want} `)) return row;
    }
  }
  return null;
}

export function isWoProcedureCode(code: string): boolean {
  return /^WO-TR-\d+$/i.test(code) || /^NAFTA-PROC-/i.test(code);
}

export function isWoRoomCode(code: string): boolean {
  return /^WO-ROOM-\d+$/i.test(code);
}

export function isSeedProcedureCode(code: string): boolean {
  return /^SVC-/i.test(code);
}
