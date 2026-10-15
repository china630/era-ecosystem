import { inflateRawSync } from "zlib";

function readZipEntry(buf: Buffer, entryName: string): Buffer | null {
  let i = 0;
  const want = entryName.replace(/\\/g, "/");
  while (i < buf.length - 4) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      const method = buf.readUInt16LE(i + 8);
      const comp = buf.readUInt32LE(i + 18);
      const nameLen = buf.readUInt16LE(i + 26);
      const extra = buf.readUInt16LE(i + 28);
      const name = buf.slice(i + 30, i + 30 + nameLen).toString("utf8").replace(/\\/g, "/");
      const start = i + 30 + nameLen + extra;
      const data = buf.slice(start, start + (comp || 0));
      if (name === want) {
        if (method === 0) return data;
        if (method === 8) return inflateRawSync(data);
        throw new Error(`zip method ${method} for ${name}`);
      }
      i = start + Math.max(comp, 0);
      continue;
    }
    i += 1;
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
    const label = cells[1] || cells[0] || "";
    const value = cells[2] ?? "";
    const norm = cells.slice(3).join(" ").trim();
    if (!label || /^№|^no\.?$/i.test(label) || /^parametr/i.test(label)) continue;
    rows.push({ label, value, norm });
  }
  return rows;
}

export function isFilledBlankValue(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text !== "-" && text !== "—" && text !== "1";
}
