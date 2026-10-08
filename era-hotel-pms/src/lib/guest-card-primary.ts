export type GuestContactSlice = {
  kind: string;
  value: string;
  isPrimary?: boolean;
};

export type GuestDocumentSlice = {
  docType: string;
  docNumber: string;
  isPrimary?: boolean;
};

function norm(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Primary row of the given kinds, else the first non-empty row. */
export function pickPrimaryContact(
  rows: GuestContactSlice[],
  kinds: string[],
): string | null {
  const wanted = new Set(kinds.map((k) => k.toUpperCase()));
  const matches = rows.filter(
    (r) => wanted.has(r.kind.trim().toUpperCase()) && norm(r.value),
  );
  const hit = matches.find((r) => r.isPrimary) ?? matches[0];
  return hit ? norm(hit.value) : null;
}

export function pickPrimaryDocument(
  rows: GuestDocumentSlice[],
  types: string[],
): string | null {
  const wanted = new Set(types.map((k) => k.toUpperCase()));
  const matches = rows.filter(
    (r) => wanted.has(r.docType.trim().toUpperCase()) && norm(r.docNumber),
  );
  const hit = matches.find((r) => r.isPrimary) ?? matches[0];
  return hit ? norm(hit.docNumber) : null;
}

export function formatPrimaryDocumentLabel(
  rows: Array<GuestDocumentSlice & { isPrimary?: boolean }>,
): string | null {
  const filled = rows.filter((r) => norm(r.docNumber));
  const hit = filled.find((r) => r.isPrimary) ?? filled[0];
  if (!hit) return null;
  return `${hit.docType} ${norm(hit.docNumber)}`.trim();
}
