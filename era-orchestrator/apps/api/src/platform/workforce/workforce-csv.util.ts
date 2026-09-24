export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export function foldHeader(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/i̇/g, "i")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i");
}

export function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => foldHeader(h));
  for (const name of names) {
    const i = lower.indexOf(foldHeader(name));
    if (i >= 0) return i;
  }
  return -1;
}

export function headerIndexContains(headers: string[], ...names: string[]): number {
  const exact = headerIndex(headers, ...names);
  if (exact >= 0) return exact;
  const lower = headers.map((h) => foldHeader(h));
  for (const name of names) {
    const n = foldHeader(name);
    if (n.length < 4) continue;
    const i = lower.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

export function col(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

export function placeCodeFromName(name: string): string {
  const folded = foldHeader(name).replace(/[^a-z0-9]+/g, "").toUpperCase();
  return (folded || "PLACE").slice(0, 64);
}

export function brigadeCodeFromName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 64);
}
