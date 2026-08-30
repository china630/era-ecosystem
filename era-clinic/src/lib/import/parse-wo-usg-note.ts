export type WoUsgServiceCode =
  | "USG-ABD"
  | "USG-THYROID"
  | "USG-BREAST"
  | "USG-DOPPLER"
  | "USG-SOFT";

export type WoUsgResultLine = { code: string; label: string; value: string };

const TITLES: Record<WoUsgServiceCode, { en: string; ru: string; az: string }> = {
  "USG-ABD": { en: "Abdominal + pelvic ultrasound (Nafta)", ru: "УЗИ живота и малого таза (Nafta)", az: "Qarın boşluğu və kiçik çanaq USM" },
  "USG-THYROID": { en: "Thyroid ultrasound", ru: "УЗИ щитовидной железы", az: "Qalxanabənzər vəzi USM" },
  "USG-BREAST": { en: "Breast ultrasound", ru: "УЗИ молочных желёз", az: "Süd vəziləri USM" },
  "USG-DOPPLER": { en: "Vascular Doppler ultrasound", ru: "УЗИ сосудов (доплер)", az: "Damər Doppler USM" },
  "USG-SOFT": { en: "Soft tissue ultrasound", ru: "УЗИ мягких тканей", az: "Yumşaq toxuma USM" },
};

const ABD_LABELS: Record<string, string> = {
  liver: "Qaraciyər",
  gallbladder: "Öd kisəsi",
  pancreas: "Pankreas",
  spleen: "Dalaq",
  rightKidney: "Sağ böyrək",
  leftKidney: "Sol böyrək",
  bladder: "Sidik kisəsi",
  prostate: "Prostat",
  uterus: "Uterus",
  ovaries: "Overlər",
  conclusion: "Nəticə",
  "meta.performer": "Radioloq",
};

const THYROID_LABELS: Record<string, string> = {
  isthmus: "İstmus",
  rightLobe: "Sağ pay",
  leftLobe: "Sol pay",
  nodes: "Düyünlər",
  conclusion: "Nəticə",
  "meta.performer": "Radioloq",
};

const BREAST_LABELS: Record<string, string> = {
  rightBreast: "Sağ süd vəzi",
  leftBreast: "Sol süd vəzi",
  conclusion: "Nəticə",
  "meta.performer": "Radioloq",
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c");
}

/** WO Müayinə Anketi type → ERA DiagnosticService.code. Name only — do not sniff Qeyd. */
export function mapWoUsgServiceCode(form: {
  diagnoses?: unknown;
  notes?: unknown;
  note?: unknown;
}): WoUsgServiceCode | null {
  const diagnoses = Array.isArray(form.diagnoses) ? form.diagnoses : [];
  const name = diagnoses
    .map((d) => {
      if (!d || typeof d !== "object") return "";
      const row = d as { diagnosisName?: unknown; name?: unknown };
      return String(row.diagnosisName || row.name || "");
    })
    .join(" ");
  const n = fold(name);
  const nRaw = name.toLowerCase();
  const compact = n.replace(/[^a-z0-9]+/g, "");
  if (!n.trim() && !nRaw.trim()) return null;

  if (/sud\s*vez|breast|mammar/.test(n) || /молоч/.test(nRaw)) return "USG-BREAST";
  if (/tiroid|qalxanabenz|shitovid/.test(n) || /щитовид/.test(nRaw)) return "USG-THYROID";
  if (/dopler|doppler/.test(n) || /доплер/.test(nRaw)) return "USG-DOPPLER";
  if (/sethi|yumsaq\s*toxuma/.test(n) || /мягк/.test(nRaw)) return "USG-SOFT";
  if (/usm|usg|usi|ultrason|abdomen|qaraciyer/.test(n) || compact === "usm" || compact === "usg" || /узи|живот/.test(nRaw)) {
    return "USG-ABD";
  }
  return null;
}

export function woUsgServiceTitle(code: WoUsgServiceCode): { en: string; ru: string; az: string } {
  return TITLES[code];
}

type Marker = { key: string; re: RegExp };

function sliceByMarkers(text: string, markers: Marker[]): Record<string, string> {
  const hits: { key: string; start: number; bodyAt: number }[] = [];
  for (const m of markers) {
    const match = m.re.exec(text);
    if (!match) continue;
    hits.push({ key: m.key, start: match.index, bodyAt: match.index + match[0].length });
  }
  hits.sort((a, b) => a.start - b.start);
  const out: Record<string, string> = {};
  for (let i = 0; i < hits.length; i += 1) {
    const end = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const raw = text.slice(hits[i].bodyAt, end).replace(/^\s*[:.\-–]?\s*/, "").trim();
    if (raw) out[hits[i].key] = collapseWs(raw);
  }
  return out;
}

function collapseWs(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractPerformer(text: string): string | null {
  const m = text.match(/Dr\.?\s*\/?\s*Radioloq[:\s]*([^\n]+)/i) || text.match(/Dr\.?\s*Radioloq[:\s]*([^\n]+)/i);
  if (!m) return null;
  return collapseWs(m[1].replace(/_+/g, "").trim());
}

function extractConclusion(text: string): string | null {
  const m = text.match(/N[əe]tic[əe]\.?\s*([\s\S]*?)(?=Dr\.?\s|Dr\/|$)/i) || text.match(/Заключен[иье][:\s]*([\s\S]*?)(?=Dr\.?\s|$)/i);
  if (!m) return null;
  return collapseWs(m[1]);
}

function toLines(fields: Record<string, string>, labels: Record<string, string>): WoUsgResultLine[] {
  const lines: WoUsgResultLine[] = [];
  for (const [code, value] of Object.entries(fields)) {
    if (!value) continue;
    lines.push({ code, label: labels[code] || code, value });
  }
  return lines;
}

function parseAbdomen(text: string): WoUsgResultLine[] {
  const sliced = sliceByMarkers(text, [
    { key: "liver", re: /Qaraciy[əe]r|Печень/i },
    { key: "gallbladder", re: /Öd\s*kis[əe]si|Желчн/i },
    { key: "pancreas", re: /Pankreas|Поджелудочн/i },
    { key: "spleen", re: /Dalaq|Селез[её]нк/i },
    { key: "rightKidney", re: /Sağ\s*böyr[əe]k|Правая\s*почк/i },
    { key: "leftKidney", re: /Sol\s*böyr[əe]k|Левая\s*почк/i },
    { key: "bladder", re: /Sidik\s*kis[əe]si|Мочев/i },
    { key: "prostate", re: /Prostat|Предстательн/i },
    { key: "uterus", re: /Uterus|Матка/i },
    { key: "ovaries", re: /H[əe]r\s*iki\s*over|Overl[əe]r|Яичник/i },
    { key: "conclusion", re: /N[əe]tic[əe]|Заключен/i },
  ]);
  const performer = extractPerformer(text);
  if (performer) sliced["meta.performer"] = performer;
  if (sliced.conclusion) {
    sliced.conclusion = sliced.conclusion.replace(/\s*Dr\.?[\s\S]*$/i, "").trim();
  } else {
    const c = extractConclusion(text);
    if (c) sliced.conclusion = c;
  }
  return toLines(sliced, ABD_LABELS);
}

function parseThyroid(text: string): WoUsgResultLine[] {
  const sliced = sliceByMarkers(text, [
    { key: "isthmus", re: /[Iİıi]sthmus|Перешеек/i },
    { key: "rightLobe", re: /Sağ\s*lob|Правая\s*доля/i },
    { key: "leftLobe", re: /Sol\s*lob|Левая\s*доля/i },
    { key: "conclusion", re: /N[əe]tic[əe]|Заключен/i },
  ]);
  const performer = extractPerformer(text);
  if (performer) sliced["meta.performer"] = performer;
  if (sliced.conclusion) {
    sliced.conclusion = sliced.conclusion.replace(/\s*Dr\.?[\s\S]*$/i, "").trim();
  }
  return toLines(sliced, THYROID_LABELS);
}

function parseBreast(text: string): WoUsgResultLine[] {
  const sliced = sliceByMarkers(text, [
    { key: "rightBreast", re: /Sağ\s*süd|Правая\s*молоч/i },
    { key: "leftBreast", re: /Sol\s*süd|Левая\s*молоч/i },
    { key: "conclusion", re: /N[əe]tic[əe]|Заключен/i },
  ]);
  const performer = extractPerformer(text);
  if (performer) sliced["meta.performer"] = performer;
  return toLines(sliced, BREAST_LABELS);
}

function parseFindings(text: string, labels: Record<string, string>): WoUsgResultLine[] {
  const conclusion = extractConclusion(text);
  const performer = extractPerformer(text);
  let findings = text;
  if (conclusion) findings = findings.replace(/N[əe]tic[əe][\s\S]*$/i, "").trim();
  findings = findings.replace(/Dr\.?[\s\S]*$/i, "").trim();
  const fields: Record<string, string> = {};
  if (findings) fields.findings = collapseWs(findings);
  if (conclusion) fields.conclusion = conclusion;
  if (performer) fields["meta.performer"] = performer;
  return toLines(fields, { ...labels, findings: "Tapıntılar", conclusion: "Nəticə", "meta.performer": "Radioloq" });
}

export function parseWoUsgNote(code: WoUsgServiceCode, notes: string): WoUsgResultLine[] {
  const text = String(notes || "").trim();
  if (!text) return [];
  if (code === "USG-ABD") return parseAbdomen(text);
  if (code === "USG-THYROID") return parseThyroid(text);
  if (code === "USG-BREAST") return parseBreast(text);
  return parseFindings(text, {});
}

/** Keep WO Qeyd so a failed/partial parse never loses the source text. */
export function withRawQeydFallback(lines: WoUsgResultLine[], raw: string): WoUsgResultLine[] {
  const text = String(raw || "").trim();
  if (!text) return lines;
  if (lines.some((l) => l.code === "sourceNote")) return lines;
  return [...lines, { code: "sourceNote", label: "Qeyd", value: text }];
}

export function parseWoUsgNoteWithFallback(
  code: WoUsgServiceCode,
  notes: string,
): WoUsgResultLine[] {
  return withRawQeydFallback(parseWoUsgNote(code, notes), notes);
}

export function isWoUsgExam(form: { diagnoses?: unknown; notes?: unknown; note?: unknown }): boolean {
  return mapWoUsgServiceCode(form) != null;
}
