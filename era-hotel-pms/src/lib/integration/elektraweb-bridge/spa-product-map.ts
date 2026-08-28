export type SpaProductHit = { id: number; name: string };

/** Nafta SPA product ids captured 2026-08-27. Unknown codes must FAIL, never guess. */
const BY_CODE: Record<string, SpaProductHit> = {
  "SVC-HIDROKOLONOTERAPIYA": { id: 1516296, name: "Hidrokalon" },
  "SVC-HIDROKOLONOTERAPIYA-BITKI-CAYI-ILE": { id: 1516296, name: "Hidrokalon" },
  "SVC-FITO-TERAPIYA-BOCKA": { id: 1516299, name: "Fitoterapiya ( boçka )" },
  "SVC-INQALYASIYA": { id: 1516305, name: "İnqalyasiya" },
  "SVC-OZONTERAPIYA": { id: 1516306, name: "Ozonterapiya" },
};

const BY_NAME: Record<string, number> = {
  hidrokalon: 1516296,
  hidrokolon: 1516296,
  hidrokolonoterapiya: 1516296,
  "fitoterapiya bocka": 1516299,
  fitoterapiya: 1516299,
  inqalyasiya: 1516305,
  "inhalation therapy": 1516305,
  ozonterapiya: 1516306,
};

export function normalizeSpaName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[İIı]/g, "i")
    .replace(/[Əə]/g, "e")
    .replace(/[Öö]/g, "o")
    .replace(/[Üü]/g, "u")
    .replace(/[Çç]/g, "c")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .toLowerCase()
    .replace(/\u0307/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function lookupSpaProduct(input: {
  procedureCode?: string | null;
  procedureName?: string | null;
}): SpaProductHit | null {
  const code = input.procedureCode?.trim();
  if (code && BY_CODE[code]) return BY_CODE[code]!;
  const name = input.procedureName?.trim();
  if (!name) return null;
  const id = BY_NAME[normalizeSpaName(name)];
  if (!id) return null;
  const fromCode = Object.values(BY_CODE).find((row) => row.id === id);
  return { id, name: fromCode?.name ?? name };
}
