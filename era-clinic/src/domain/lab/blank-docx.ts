import { inflateRawSync } from "zlib";

function inflateEntry(method: number, data: Buffer, name: string): Buffer {
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`zip method ${method} for ${name}`);
}

/** Central directory sizes. Word often leaves the local header size at 0. */
function readZipEntry(buf: Buffer, entryName: string): Buffer | null {
  const want = entryName.replace(/\\/g, "/");
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd >= 0) {
    const cdSize = buf.readUInt32LE(eocd + 12);
    let p = buf.readUInt32LE(eocd + 16);
    const end = Math.min(buf.length, p + cdSize);
    while (p + 46 <= end && buf.readUInt32LE(p) === 0x02014b50) {
      const method = buf.readUInt16LE(p + 10);
      const comp = buf.readUInt32LE(p + 20);
      const nameLen = buf.readUInt16LE(p + 28);
      const extra = buf.readUInt16LE(p + 30);
      const comment = buf.readUInt16LE(p + 32);
      const localOff = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8").replace(/\\/g, "/");
      if (name === want && localOff + 30 <= buf.length) {
        const localName = buf.readUInt16LE(localOff + 26);
        const localExtra = buf.readUInt16LE(localOff + 28);
        const start = localOff + 30 + localName + localExtra;
        return inflateEntry(method, buf.slice(start, start + comp), name);
      }
      p += 46 + nameLen + extra + comment;
    }
  }
  return null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cellText(xml: string): string {
  const texts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) texts.push(decodeXmlEntities(match[1] ?? ""));
  return texts.join("").replace(/\s+/g, " ").trim();
}

export type BlankTableRow = {
  label: string;
  value: string;
  norm: string;
};

/** Paragraphs in document order. A narrative USM blank is headings plus the sentences under them. */
export function extractDocxParagraphs(docx: Buffer): string[] {
  const xml = readZipEntry(docx, "word/document.xml");
  if (!xml) return [];
  const text = xml.toString("utf8");
  const paragraphs: string[] = [];
  for (const paragraph of text.split(/<\/w:p>/)) {
    const line = cellText(paragraph);
    if (line) paragraphs.push(line);
  }
  return paragraphs;
}

/** Table rows from a docx. Drawing coordinates and the footer are ignored. */
export function extractBlankTable(docx: Buffer): BlankTableRow[] {
  const xml = readZipEntry(docx, "word/document.xml");
  if (!xml) return [];
  const text = xml.toString("utf8");
  const rows: BlankTableRow[] = [];
  for (const tr of text.split(/<\/w:tr>/)) {
    if (!/<w:tc[\s>]/.test(tr)) continue;
    const cells = tr
      .split(/<\/w:tc>/)
      .filter((cell) => /<w:tc[\s>]/.test(cell))
      .map(cellText);
    if (cells.length < 2) continue;
    const namedAt = cells.findIndex((cell) => /[A-Za-zƏəİıÖöÜüĞğÇçŞşА-Яа-я]/.test(cell));
    const label = namedAt >= 0 ? cells[namedAt]! : cells[1] || cells[0] || "";
    const value =
      cells.slice(namedAt >= 0 ? namedAt + 1 : 2).find((cell) => isFilledBlankValue(cell)) ?? "";
    const norm = cells.slice((namedAt >= 0 ? namedAt : 1) + 2).join(" ").trim();
    if (!label || /^№|^no\.?$/i.test(label) || /^parametr/i.test(label)) continue;
    rows.push({ label, value, norm });
  }
  return rows;
}

export function isFilledBlankValue(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text !== "-" && text !== "—";
}
