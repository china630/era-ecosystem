/**
 * Idempotent lab-panel enrichment (v1.2).
 * Sources: Nafta Analyses price list, Exonlab special panels, MediClub public menus
 * (biochem + general clinical), Eurolab/Liv category pages.
 * Target: clinic + MediClub/Exonlab routine layer — not Referans 7000 / LOINC.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "..", "seed-data", "diagnostic-lab-catalog.json");
const c = JSON.parse(readFileSync(path, "utf8"));

c.version = "1.2.0";
c.notes =
  "ERA Clinic diagnostic & lab catalog v1.2 (AZ clinic + MediClub/Exonlab routine layer). kinds: imaging|functional|endoscopy|lab_panel|visit. packages[] = checkup compositions. Rare send-out stays admin-added.";

const L = (en, ru, az) => ({ en, ru, az });

function panel(code) {
  const p = c.labPanels.find((x) => x.code === code);
  if (!p) throw new Error("missing panel " + code);
  return p;
}

function addA(panelCode, a) {
  const p = panel(panelCode);
  if (p.analytes.some((x) => x.code === a.code)) return false;
  p.analytes.push(a);
  return true;
}

function A(code, unit, en, ru, az, refMin, refMax) {
  const row = { code, unit, label: L(en, ru, az) };
  if (refMin != null) row.refMin = String(refMin);
  if (refMax != null) row.refMax = String(refMax);
  return row;
}

function addLab(p) {
  if (c.labPanels.some((x) => x.code === p.code)) return;
  c.labPanels.push(p);
}

// --- CBC (Nafta 18-param Sysmex + MediClub hematology) ---
[
  A("MCV", "fL", "MCV", "MCV", "MCV", "80", "96"),
  A("MCH", "pg", "MCH", "MCH", "MCH", "27", "33"),
  A("MCHC", "g/L", "MCHC", "MCHC", "MCHC", "320", "360"),
  A("RDW-CV", "%", "RDW-CV", "RDW-CV", "RDW-CV"),
  A("RDW-SD", "fL", "RDW-SD", "RDW-SD", "RDW-SD"),
  A("MPV", "fL", "MPV", "MPV", "MPV"),
  A("PDW", "fL", "PDW", "PDW", "PDW"),
  A("P-LCR", "%", "P-LCR", "P-LCR", "P-LCR"),
  A("PLT-PCT", "%", "Plateletcrit", "Тромбокрит", "Trombositokrit", "0.1", "0.5"),
  A("MXD%", "%", "MXD %", "Смесь %", "MXD %"),
  A("NEUT#", "10^9/L", "Neutrophils abs", "Нейтрофилы абс.", "Neytrofil abs"),
  A("LYMPH#", "10^9/L", "Lymphocytes abs", "Лимфоциты абс.", "Limfosit abs"),
  A("MONO#", "10^9/L", "Monocytes abs", "Моноциты абс.", "Monosit abs"),
  A("EOS#", "10^9/L", "Eosinophils abs", "Эозинофилы абс.", "Eozinofil abs"),
  A("BASO#", "10^9/L", "Basophils abs", "Базофилы абс.", "Bazofil abs"),
  A("RETIC", "%", "Reticulocytes", "Ретикулоциты", "Retikulositlər"),
].forEach((a) => addA("LAB-CBC", a));

// --- Biochem core (Nafta BIOKIM + MediClub common enzymes) ---
[
  A("IBIL", "µmol/L", "Indirect bilirubin", "Билирубин непрямой", "Dolayı bilirubin"),
  A("GLOB", "g/L", "Globulin", "Глобулин", "Qlobalin"),
  A("AG", "", "A/G ratio", "А/Г", "A/G"),
  A("AMY", "U/L", "Amylase", "Амилаза", "Amilaza"),
  A("LIPASE", "U/L", "Lipase", "Липаза", "Lipaza"),
  A("LDH", "U/L", "LDH", "ЛДГ", "LDH"),
  A("CK", "U/L", "CK", "КК", "CK"),
  A("HBDH", "U/L", "HBDH", "ГБДГ", "HBDH"),
  A("CHE", "U/L", "Cholinesterase", "Холинэстераза", "Xolinesteraza"),
  A("LAC", "mmol/L", "Lactate", "Лактат", "Laktat"),
  A("NH3", "µmol/L", "Ammonia", "Аммиак", "Ammoniak"),
  A("BUN", "mmol/L", "BUN", "Азот мочевины", "BUN"),
  A("FE", "µmol/L", "Iron", "Железо", "Dəmir"),
  A("TIBC", "µmol/L", "TIBC", "ОЖСС", "TIBC"),
  A("UIBC", "µmol/L", "UIBC", "НЖСС", "UIBC"),
  A("FERR", "ng/mL", "Ferritin", "Ферритин", "Ferritin"),
  A("TRF", "g/L", "Transferrin", "Трансферрин", "Transferrin"),
].forEach((a) => addA("LAB-BIOCHEM", a));

addA("LAB-ELECTRO", A("TCO2", "mmol/L", "Total CO2", "Общий CO2", "Ümumi CO2"));
addA("LAB-ELECTRO", A("ICA", "mmol/L", "Ionized calcium", "Кальций ионизированный", "İonlaşmış Ca"));

addA("LAB-COAG", A("TT", "s", "Thrombin time", "Тромбиновое время", "Trombin vaxtı"));
addA("LAB-COAG", A("AT3", "%", "Antithrombin III", "Антитромбин III", "Antitrombin III"));

addA("LAB-GLUCOSE", A("HOMA", "", "HOMA-IR", "HOMA-IR", "HOMA-IR"));
addA("LAB-GLUCOSE", A("GLU", "mmol/L", "Glucose", "Глюкоза", "Qlükoza", "3.9", "6.1"));
addA("LAB-GLUCOSE", A("MAU", "mg/L", "Microalbumin urine", "МАУ", "MAU"));

[
  A("TT3", "nmol/L", "Total T3", "Т3 общий", "Ümumi T3"),
  A("TT4", "nmol/L", "Total T4", "Т4 общий", "Ümumi T4"),
  A("TG", "ng/mL", "Thyroglobulin", "Тиреоглобулин", "Tireoqlobulin"),
  A("CALCIT", "pg/mL", "Calcitonin", "Кальцитонин", "Kalsitonin"),
].forEach((a) => addA("LAB-THYROID", a));

addA("LAB-SEX-HORM", A("SHBG", "nmol/L", "SHBG", "ГСПГ", "SHBG"));
addA("LAB-SEX-HORM", A("DHEAS", "µg/dL", "DHEA-S", "ДГЭА-С", "DHEA-S"));
addA("LAB-SEX-HORM", A("INHB", "pg/mL", "Inhibin B", "Ингибин B", "Inhibin B"));

addA("LAB-LIPID", A("VLDL", "mmol/L", "VLDL", "ЛПОНП", "VLDL"));
addA("LAB-LIPID", A("APOA1", "g/L", "ApoA1", "ApoA1", "ApoA1"));

[
  A("IBIL", "µmol/L", "Indirect bilirubin", "Билирубин непрямой", "Dolayı bilirubin"),
  A("GLOB", "g/L", "Globulin", "Глобулин", "Qlobalin"),
  A("AG", "", "A/G ratio", "А/Г", "A/G"),
  A("LDH", "U/L", "LDH", "ЛДГ", "LDH"),
  A("CHE", "U/L", "Cholinesterase", "Холинэстераза", "Xolinesteraza"),
  A("PT", "s", "PT (liver)", "ПВ (печень)", "PT"),
].forEach((a) => addA("LAB-LIVER", a));

addA("LAB-RENAL", A("MAU", "mg/L", "Microalbumin urine", "МАУ", "MAU"));
addA("LAB-RENAL", A("GLU", "mmol/L", "Glucose", "Глюкоза", "Qlükoza"));
addA("LAB-RENAL", A("UA", "µmol/L", "Uric acid", "Мочевая кислота", "Sidik turşusu"));
addA("LAB-RENAL", A("CA", "mmol/L", "Calcium", "Кальций", "Kalsium"));
addA("LAB-RENAL", A("P", "mmol/L", "Phosphorus", "Фосфор", "Fosfor"));
addA("LAB-RENAL", A("TCO2", "mmol/L", "Total CO2", "Общий CO2", "Ümumi CO2"));

[
  A("AST", "U/L", "AST", "АСТ", "AST"),
  A("LDH", "U/L", "LDH", "ЛДГ", "LDH"),
  A("HBDH", "U/L", "HBDH", "ГБДГ", "HBDH"),
  A("CK", "U/L", "CK", "КК", "CK"),
  A("HSCRP", "mg/L", "hs-CRP", "вч-СРБ", "hs-CRP"),
  A("LPA", "nmol/L", "Lp(a)", "Lp(a)", "Lp(a)"),
].forEach((a) => addA("LAB-CARDIAC", a));

[
  A("U-MUCUS", "", "Mucus", "Слизь", "Selik"),
  A("U-SALT", "", "Salts / crystals", "Соли", "Duzlar"),
  A("U-URO", "", "Urobilinogen", "Уробилиноген", "Urobilinogen"),
  A("U-BIL", "", "Bilirubin", "Билирубин", "Bilirubin"),
].forEach((a) => addA("LAB-URINE", a));

addA("LAB-VITMIN", A("FOL", "ng/mL", "Folate", "Фолат", "Folat"));
addA("LAB-ENDO-HORM", A("PTH", "pg/mL", "PTH", "ПТГ", "PTH"));
addA("LAB-ENDO-HORM", A("GH", "ng/mL", "Growth hormone", "СТГ", "Boy hormonu"));
addA("LAB-ENDO-HORM", A("IGF1", "ng/mL", "IGF-1", "IGF-1", "IGF-1"));

addLab({
  code: "LAB-SMEAR",
  category: "hematology",
  title: L("Peripheral smear microscopy", "Микроскопия мазка", "Yaxma mikroskopiyası"),
  serviceCode: "LAB-SMEAR",
  analytes: [
    A("SMEAR-NOTE", "", "Smear description", "Описание мазка", "Yaxma təsviri"),
    A("SMEAR-RBC", "", "RBC morphology", "Морфология эритроцитов", "Eritrosit morfologiyası"),
    A("SMEAR-WBC", "", "WBC morphology", "Морфология лейкоцитов", "Leykosit morfologiyası"),
    A("SMEAR-PLT", "", "Platelet estimate", "Тромбоциты (оценка)", "Trombosit qiyməti"),
  ],
});

addLab({
  code: "LAB-BIOCHEM-EXT",
  category: "biochemistry",
  title: L("Biochemistry extended (clinic/send-in)", "Биохимия расширенная", "Biokimya geniş"),
  serviceCode: "LAB-BIOCHEM-EXT",
  analytes: [
    A("ACE", "U/L", "ACE", "АПФ", "ACE"),
    A("AAT", "mg/dL", "Alpha-1 antitrypsin", "А1-антитрипсин", "Alfa-1 antitripsin"),
    A("CERU", "mg/dL", "Ceruloplasmin", "Церулоплазмин", "Seruloplazmin"),
    A("G6PD", "U/g Hb", "G6PD", "Г6ФД", "G6PD"),
    A("ADA", "U/L", "ADA", "АДА", "ADA"),
    A("ACP", "U/L", "Acid phosphatase", "Кислая фосфатаза", "Turşu fosfataza"),
    A("BILE", "µmol/L", "Bile acids", "Жёлчные кислоты", "Öd turşuları"),
    A("OSMO", "mOsm/kg", "Osmolality", "Осмоляльность", "Osmolyarlıq"),
    A("SAA", "mg/L", "Serum amyloid A", "Амилоид A", "Amiloid A"),
    A("HAPT", "g/L", "Haptoglobin", "Гаптоглобин", "Haptoqlobin"),
    A("EPO", "mIU/mL", "Erythropoietin", "Эритропоэтин", "Eritropoetin"),
    A("OSTEO", "ng/mL", "Osteocalcin", "Остеокальцин", "Osteokalsin"),
    A("ZON", "ng/mL", "Zonulin", "Зонулин", "Zonulin"),
    A("CARN", "µmol/L", "Carnitine", "Карнитин", "Karnitin"),
    A("AA-PROF", "", "Amino acid profile", "Профиль аминокислот", "Amin turşuları"),
    A("PEP", "", "Protein electrophoresis", "Электрофорез белка", "Zülal elektroforezi"),
  ],
});

addLab({
  code: "LAB-CELIAC",
  category: "immunology",
  title: L("Celiac panel", "Целиакия", "Seliakiya"),
  serviceCode: "LAB-CELIAC",
  analytes: [
    A("TTG-IGA", "U/mL", "tTG IgA", "тТГ IgA", "tTG IgA"),
    A("TTG-IGG", "U/mL", "tTG IgG", "тТГ IgG", "tTG IgG"),
    A("EMA-IGA", "", "EMA IgA", "ЭМА IgA", "EMA IgA"),
    A("DGP-IGA", "U/mL", "DGP IgA", "DGP IgA", "DGP IgA"),
  ],
});

const nAnalytes = c.labPanels.reduce((s, p) => s + p.analytes.length, 0);
writeFileSync(path, JSON.stringify(c, null, 2) + "\n", "utf8");
console.log("panels", c.labPanels.length, "analytes", nAnalytes);
