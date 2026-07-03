export type ImportRow = {
  title: string;
  taxId?: string;
  companyName?: string;
  contactPhone?: string;
  contactEmail?: string;
  activitySector?: string;
  addressLabel?: string;
  sourceRef?: string;
  partyKind: "INDIVIDUAL" | "LEGAL_ENTITY";
  matchStatus?: string;
  needsVoenReview?: boolean;
};

export type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const COLUMN_ALIASES: Record<string, string[]> = {
  voen: ["voen", "taxid", "tax_id", "vön"],
  tax_name: ["tax_name", "taxname", "company_name", "companyname"],
  donor_names: ["donor_names", "donornames", "name", "title"],
  donor_phones: ["donor_phones", "donorphones", "phone", "contact_phone"],
  donor_emails: ["donor_emails", "donoremails", "email", "contact_email"],
  donor_sectors: ["donor_sectors", "donorsectors", "sector", "activity_sector"],
  tax_legal_address: ["tax_legal_address", "address", "address_label"],
  donor_ids: ["donor_ids", "donorids", "source_ref"],
  match_status: ["match_status", "matchstatus"],
  donor_voens: ["donor_voens", "donorvoens"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function firstPipeSegment(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const seg = value.split("|")[0]?.trim();
  return seg || undefined;
}

export function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const i = normalized.indexOf(alias);
      if (i >= 0) {
        index[canonical] = i;
        break;
      }
    }
  }
  return index;
}

export function mapRowToImport(
  cells: string[],
  colIndex: Record<string, number>,
  rowNum: number,
): ImportRow | { error: string } {
  const get = (key: string) => {
    const i = colIndex[key];
    if (i === undefined) return undefined;
    return cells[i]?.trim() || undefined;
  };

  const voen =
    get("voen") ?? firstPipeSegment(get("donor_voens"));
  const taxName = get("tax_name");
  const donorName = firstPipeSegment(get("donor_names"));
  const phone = firstPipeSegment(get("donor_phones"));
  const email = firstPipeSegment(get("donor_emails"));
  const sector = firstPipeSegment(get("donor_sectors"));
  const address = get("tax_legal_address");
  const sourceRef = firstPipeSegment(get("donor_ids"));
  const matchStatus = get("match_status");

  const hasVoen = voen && /^\d{10}$/.test(voen);
  const partyKind = hasVoen ? "LEGAL_ENTITY" : "INDIVIDUAL";
  const companyName = taxName ?? donorName;
  const title = companyName ?? donorName ?? phone ?? `Import row ${rowNum}`;

  if (!title.trim() && !phone && !voen) {
    return { error: "Row has no name, phone, or VÖEN" };
  }

  if (partyKind === "INDIVIDUAL" && !phone) {
    return { error: "Individual row requires phone" };
  }

  return {
    title: title.trim(),
    taxId: hasVoen ? voen : undefined,
    companyName: companyName?.trim(),
    contactPhone: phone,
    contactEmail: email,
    activitySector: sector,
    addressLabel: address,
    sourceRef: sourceRef ? `donor:${sourceRef}` : voen ? `voen:${voen}` : undefined,
    partyKind,
    matchStatus,
    needsVoenReview: matchStatus === "no_tax_match" && !hasVoen,
  };
}

export function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

export const IMPORT_ROW_CAP = 5000;
