/**
 * One-shot generator: Construction pilot intake questionnaire (AZ) → .docx
 * Usage: node scripts/gen-construction-pilot-intake-docx.mjs
 *
 * Each question can carry a gray hint under the label so the respondent
 * understands what we need without industry jargon ambiguity.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const docxRoot = path.join(os.tmpdir(), "era-docx-gen", "node_modules", "docx");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } =
  require(docxRoot);

const outDownloads = path.join(os.homedir(), "Downloads", "ERA-Construction-Pilot-Anket-AZ.docx");

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Calibri", size: 28 })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, font: "Calibri", size: 24 })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        italics: opts.italics || false,
        bold: opts.bold || false,
        color: opts.color,
      }),
    ],
  });
}

/** Gray helper under a question — what we want from the person. */
function hint(text) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 18,
        italics: true,
        color: "666666",
      }),
    ],
  });
}

function q(n, text) {
  return new Paragraph({
    spacing: { before: 100, after: 20 },
    children: [
      new TextRun({ text: `${n}. `, bold: true, font: "Calibri", size: 22 }),
      new TextRun({ text, font: "Calibri", size: 22 }),
    ],
  });
}

/** Question + optional gray hint + answer line. */
function item(n, text, hintText) {
  const out = [q(n, text)];
  if (hintText) out.push(hint(hintText));
  out.push(blank());
  return out;
}

function blank() {
  return new Paragraph({
    spacing: { after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 },
    },
    children: [new TextRun({ text: " ", font: "Calibri", size: 20 })],
  });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: "ERA Construction",
        bold: true,
        font: "Calibri",
        size: 36,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: "İlkin məlumat anketi (demo stend)",
        bold: true,
        font: "Calibri",
        size: 28,
      }),
    ],
  }),
  p(
    "Bu anket demo stendin sizin real məlumatlarınızla qurulması üçündür. Qısa və konkret cavab verin. Bilmirsinizsə — «yoxdur» və ya «sonra göndərəcəyəm» yazın. Excel və digər faylları anketlə birlikdə göndərə bilərsiniz.",
  ),
  p(
    "Hər sualın altında boz izah var — nəyi yazmağınızı gözlədiyimizi göstərir. Cavabları azərbaycan və ya rus dilində yaza bilərsiniz.",
    { italics: true },
  ),

  h1("1. Şirkət"),
  ...item(
    1,
    "Hüquqi ad (tam)",
    "VÖEN-də və nizamnamədə yazılan rəsmi ad — qısaltma deyil.",
  ),
  ...item(
    2,
    "Brend / ticarət adı (əgər fərqlidirsə)",
    "Vizitkartda, saytda və ya lövhədə göründüyünüz ad. Hüquqi addan fərqli deyilsə — «eyni» yazın.",
  ),
  ...item(3, "VÖEN", "10 rəqəmli vergi ödəyicisinin eyniləşdirmə nömrəsi."),
  ...item(4, "Hüquqi ünvan", "Dövlət reyestrində qeydiyyat ünvanı."),
  ...item(
    5,
    "Ofis ünvanı (fərqlidirsə)",
    "Faktiki işlədiyiniz ofis. Hüquqi ünvanla eynidirsə — «eyni» yazın.",
  ),
  ...item(6, "Telefon", "Əlaqə üçün əsas nömrə (+994…)."),
  ...item(7, "E-poçt", "Anket və demo üçün əsas iş e-poçtu."),
  ...item(8, "Sayt (varsa)", "Yoxdursa — «yoxdur»."),
  ...item(
    9,
    "Şirkətin əsas rolu: baş podratçı / alt podratçı / tikinti sifarişçisi / qarışıq (qeyd edin)",
    "Birini seçin və ya qarışıqdırsa qısa izah edin: kimə iş götürürsünüz, kimə verirsiniz.",
  ),
  ...item(
    10,
    "Qrupda neçə hüquqi şəxs var? VÖEN-ləri yazın",
    "Holding / qrupdursa bütün şirkətlərin VÖEN-ləri. Tək şirkətsinizsə — «1» və öz VÖEN-iniz.",
  ),
  ...item(
    11,
    "Demo üçün bir hüquqi şəxs kifayətdir, yoxsa bir neçəsi lazımdır?",
    "Bir neçə VÖEN eyni anda göstərilməlidirsə — hansılarını yazın.",
  ),
  ...item(
    12,
    "Uçot valyutası (adətən AZN)",
    "Mühasibat və smeta əsasən hansı valyutada aparılır.",
  ),

  h1("2. Demo-da hansı hissələr lazımdır"),
  ...item(
    13,
    "Tikinti (obyekt, smeta, sahə, aktlar) — bəli / xeyr",
    "Obyekt kartı, smeta, sahə jurnalları, iş aktları — tikinti modulunun özü.",
  ),
  ...item(
    14,
    "Maliyyə (müqavilə, ödəniş, Forma-2 / hesablaşma) — bəli / xeyr",
    "Müqavilə, ödəniş, hesablaşma sənədləri — pul tərəfi (ERA Maliyyə).",
  ),
  ...item(
    15,
    "CRM (tender / satış, tikintiyə qədər) — bəli / xeyr",
    "Tender, satış və müştəri ilə iş — tikinti başlayana qədər. «Tender» latın yazılışıdır.",
  ),
  ...item(
    16,
    "Kadr / tabel — bəli / xeyr",
    "İşçilər və iş vaxtı tabeli. Demo-da əməkhaqqı hesablaması məcburi deyil.",
  ),
  ...item(
    17,
    "Demo-da neçə istifadəçi olacaq?",
    "Eyni anda giriş edəcək təxmini adam sayı (məsələn 5–8).",
  ),
  ...item(
    18,
    "İnterfeys dili: az / ru / en (prioritet sırası)",
    "Əvvəl hansı dili görmək istəyirsiniz, məsələn: az, sonra ru.",
  ),

  h1("3. Pilot obyektlər (1–2 real obyekt)"),
  p(
    "Real tikinti obyektləri seçin — demo bu məlumatlarla doldurulacaq. İdeal: 1–2 obyekt.",
    { italics: true, color: "666666" },
  ),
  h2("Obyekt 1"),
  ...item(19, "Adı", "Obyektin sizdəki iş adı (məsələn «Nizami 12 yaşayış»)."),
  ...item(20, "Ünvan / rayon", "Şəhər, rayon, küçə — mümkün qədər dəqiq."),
  ...item(
    21,
    "Tip: yaşayış / kommersiya / infrastruktur / təmir / digər",
    "Birini seçin; digərdirsə qısa yazın.",
  ),
  ...item(
    22,
    "Sizin rolunuz: baş podratçı / alt podratçı / texniki sifarişçi / digər",
    "Bu obyektdə şirkətinizin rolu — bütöv şirkət rolundan fərqli ola bilər.",
  ),
  ...item(
    23,
    "Mərhələ: layihələndirmə / tikinti / təhvil / zəmanət",
    "İndi obyekt hansı mərhələdədir.",
  ),
  ...item(
    24,
    "Planlaşdırılan başlama və bitmə tarixləri",
    "Təxmini ay/il kifayətdir (məsələn 03.2025 – 11.2026).",
  ),
  ...item(
    25,
    "Müqavilə / smeta məbləği (təxmini də ola bilər)",
    "AZN ilə; dəqiq rəqəm yoxdursa diapazon və ya «təxmini …».",
  ),
  ...item(
    26,
    "Obyekt daxilində korpus / mərhələ / zona varmı?",
    "Bəli isə qısa siyahı (məsələn A/B korpus, 1–2 növbə).",
  ),
  h2("Obyekt 2 (varsa)"),
  p("İkinci obyekt yoxdursa bu bloku boş buraxın.", { italics: true, color: "666666" }),
  ...item(27, "Adı", "İkinci obyektin iş adı."),
  ...item(28, "Ünvan / rayon", "Şəhər, rayon, küçə."),
  ...item(29, "Tip", "Yaşayış / kommersiya / infrastruktur / təmir / digər."),
  ...item(30, "Sizin rolunuz", "Bu obyektdə baş / alt podratçı / texniki sifarişçi / digər."),
  ...item(31, "Mərhələ", "Layihələndirmə / tikinti / təhvil / zəmanət."),
  ...item(32, "Plan tarixləri", "Başlama – bitmə (təxmini)."),
  ...item(33, "Müqavilə / smeta məbləği", "AZN; təxmini ola bilər."),
  ...item(34, "Korpus / mərhələ / zona", "Bölgü varsa qısa siyahı."),

  h1("4. Smeta və sənədlər (dövlət layihələri üçün)"),
  p(
    "Dövlət və ya sifarişçi tələb edən smeta paketi haqqında. Özəl BOQ-only işdirsə də cavab verin.",
    { italics: true, color: "666666" },
  ),
  ...item(
    35,
    "Tam smeta paketi aparırsınızmı: lokal → obyekt → toplu (xülasə) smeta?",
    "Lokal = iş növləri üzrə sətirlər; obyekt = bir tikili; toplu = bütün obyektlərin xülasəsi. Belə paket varmı?",
  ),
  ...item(
    36,
    "Yoxsa əsasən müqavilə smetası / bir BOQ kifayətdir?",
    "BOQ = iş həcmləri cədvəli (Bill of Quantities). Bir cədvəl kifayət edirsə — bəli.",
  ),
  ...item(
    37,
    "Smetaları indi harada aparırsınız: Excel / Smeta.az / 1C / digər",
    "Əsas aləti yazın; digərdirsə proqramın adını.",
  ),
  ...item(
    38,
    "Smeta ekspertizadan / sifarişçinin təsdiqindən keçirmi?",
    "Bəli / xeyr; kim təsdiq edir (ekspertiza, sifarişçi, hər ikisi).",
  ),
  ...item(
    39,
    "Demo-da Forma-2 lazımdır?",
    "Forma-2 — görülən işlərin qəbul aktı / hesablaşma üçün tipik sənəd. Lazımdırsa — bəli.",
  ),
  ...item(
    40,
    "Forma-3 lazımdır?",
    "Forma-3 — adətən xərclərin və ya materialların arayışı. Sizdə istifadə olunursa — bəli.",
  ),
  ...item(
    41,
    "Forma-4 — sizdə hansı sənəddir? Qısa yazın (və ya nümunə göndərin)",
    "Şirkətlərdə Forma-4 fərqli olur. Bizə sizin nümunə və ya bir cümləlik izah lazımdır.",
  ),
  ...item(
    42,
    "Forma-2 / digər arayış → təsdiq → ödəniş necə gedir? Addım-addım yazın",
    "Kim hazırlayır, kim imzalayır, kim ödəyir — 3–6 qısa addım.",
  ),
  ...item(
    43,
    "Hansı normativlər / qiymət məcmuələri istifadə olunur?",
    "Məsələn yerli smeta normaları, sifarişçi cədvəli, öz qiymət siyahınız — nə varsa.",
  ),
  ...item(
    44,
    "Plan–faktı necə yoxlayırsınız: smeta sətirləri / faiz / həcm",
    "İşin nə qədər getdiyini necə ölçürsünüz (sətir-sətir, faizlə, fiziki həcmlə).",
  ),
  ...item(
    45,
    "Obyekt 1 üçün smeta faylı əlavə edə bilərsinizmi? (Excel və s.)",
    "Demo üçün ən vacib əlavə. Bəli / sonra göndərəcəyəm / yoxdur.",
  ),

  h1("5. Sahə işləri və sənədlər"),
  ...item(
    46,
    "Gündəlik jurnal (sahə jurnalı) demo-da lazımdır?",
    "Hər gün sahədə nə iş görüldüyü, hava, adam sayı — qeyd. İngiliscə: daily log.",
  ),
  ...item(
    47,
    "Defekt / qeyd siyahısı (punch list) lazımdır?",
    "Təhvilə yaxın: düzəlməli nöqsanların siyahısı. İngiliscə: punch list.",
  ),
  ...item(
    48,
    "RFI / razılaşdırma lazımdır?",
    "RFI = Request for Information — sifarişçiyə / layihəçiyə rəsmi sual və cavab. Demo-da lazımdırmı?",
  ),
  ...item(
    49,
    "Çertyoj versiyaları (PDF / DWG) lazımdırmı?",
    "Layihə çertyojlarının versiya ilə saxlanması. Ən azı nümunə PDF kifayət edə bilər.",
  ),
  ...item(
    50,
    "Qrafik (Gantt / Excel / MS Project) lazımdırmı?",
    "İşlərin vaxt qrafiki. Hansı formatda aparırsınızsa onu yazın.",
  ),
  ...item(
    51,
    "Foto hesabat dərhal lazımdırmı?",
    "Sahədən foto ilə hesabat — demo-nun ilk həftəsində lazımdırmı?",
  ),

  h1("6. Kontragentlər və pul"),
  ...item(
    52,
    "Əsas sifarişçi (ad, VÖEN)",
    "Bu pilot obyekt üzrə əsas müştəri / sifarişçi.",
  ),
  ...item(
    53,
    "3–5 əsas alt podratçı (ad, VÖEN)",
    "Demo-da göstərəcəyimiz tipik alt podratçılar.",
  ),
  ...item(
    54,
    "Tipik müqavilələr: baş podrat / alt podrat / təchizat",
    "Hansı müqavilə növləri ən çoxdur — birini və ya bir neçəsini qeyd edin.",
  ),
  ...item(
    55,
    "Akt və ödənişi indi necə edirsiniz?",
    "Kim akt yazır, kim təsdiq edir, ödəniş necə gedir — qısa proses.",
  ),
  ...item(
    56,
    "Material tədarükü: təchizat şöbəsi / Excel / digər",
    "Material sifarişi və tədarükü harada aparılır.",
  ),
  ...item(
    57,
    "Bank hesabları — demo Maliyyə üçün lazımdırsa qeyd edin",
    "Hesab nömrələrini yalnız razılaşdırılmış demo üçün yazın; yoxdursa — «lazım deyil».",
  ),

  h1("7. İstifadəçilər və giriş"),
  ...item(
    58,
    "Pilot komanda: ad, soyad, ata adı; telefon və ya e-poçt; rol; obyekt",
    "Kim demo-ya girəcək — siyahı. Rol: məsələn sahə rəisi, smetacı, mühasib.",
  ),
  ...item(
    59,
    "Kim pulu görür, kim yalnız sahəni",
    "Hüquqlar: kimə maliyyə açıqdır, kim yalnız tikinti / sahə məlumatını görür.",
  ),
  ...item(
    60,
    "Sahib / rəhbər üçün vahid giriş (SSO) lazımdırmı?",
    "SSO = bir dəfə girişlə ERA-nın bir neçə moduluna keçid. Lazımdır / sonra / xeyr.",
  ),
  ...item(
    61,
    "Demo məlumatını dəyişmək olar, yoxsa əsasən baxış + idxal?",
    "İdxal = Excel və s. yükləmə. Redaktə edə biləcəksiniz, yoxsa əsasən baxacaqsınız?",
  ),

  h1("8. Göndərin (fayl siyahısı)"),
  p(
    "Bu bölmədə «göndərəcəyəm / əlavədədir / yoxdur» yazın. Faylları e-poçt və ya disk linki ilə göndərə bilərsiniz.",
    { italics: true, color: "666666" },
  ),
  ...item(62, "Obyekt smetası (Excel və s.)", "Obyekt 1 üçün əsas smeta faylı."),
  ...item(
    63,
    "İş həcmləri cədvəli / smeta sətirləri",
    "BOQ və ya smeta sətirlərinin cədvəli — ayrı fayldırsa.",
  ),
  ...item(64, "Müqavilə siyahısı (varsa)", "Aktiv müqavilələrin qısa siyahısı və ya Excel."),
  ...item(
    65,
    "İşçi / rol siyahısı",
    "Demo istifadəçiləri və rolları — Excel və ya sadə siyahı.",
  ),
  ...item(
    66,
    "Çertyojlar (ən azı 1–2 vərəq)",
    "PDF və ya DWG; bütün paket lazım deyil — nümunə kifayətdir.",
  ),
  ...item(
    67,
    "İmzalanmış Forma-2 (və ya Forma-4) nümunəsi",
    "Boş şablon yox, mümkün qədər imzalanmış / doldurulmuş nümunə.",
  ),
  ...item(
    68,
    "Sizin daxili smeta / akt reglamentiniz (varsa)",
    "Daxili qaydalar, əmrlər və ya reqlament — varsa əlavə edin.",
  ),

  h1("9. Gözləntilər"),
  ...item(
    69,
    "2–4 həftədən sonra özünüz nəyi görməlisiniz ki, «işləyir» deyəsiniz?",
    "Uğur meyarı: 2–4 konkret nəticə (məsələn smeta + Forma-2 + sahə jurnalı).",
  ),
  ...item(
    70,
    "Demo-da nəyə toxunmuruq? (məsələn BIM, əməkhaqqı və s.)",
    "Açıq şəkildə demoya daxil etmədiyimiz mövzular.",
  ),
  ...item(
    71,
    "Sizin tərəfdən əlaqə: layihə meneceri + smetacı + mühasib (adlar)",
    "Üç əsas əlaqə şəxsi. PM = layihə meneceri.",
  ),
  ...item(
    72,
    "Anketə cavab tarixi / görüş tarixi",
    "Anketi nə vaxt qaytarırsınız və ilk görüş üçün təklif olunan tarix.",
  ),
  ...item(
    73,
    "Məxfilik: NDA / buluda qoymaq olmaz / sonra yerli server (on-prem) — qeyd edin",
    "NDA lazımdırmı; məlumatı buluda qoymaq olarmı; sonra öz serverinizdə (on-prem) olacaqmı.",
  ),

  h1("Qeyd"),
  p(
    "Vacib olan — real obyekt, smeta faylı və Forma-2 (və sizdəki Forma-4) nümunəsidir. Cavablar demo stendin və sonrakı iş prosesinin qurulması üçün istifadə olunacaq.",
  ),
];

const doc = new Document({
  creator: "ERA Ecosystem",
  title: "ERA Construction — İlkin məlumat anketi",
  description: "Pilot / demo intake questionnaire (Azerbaijani)",
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);

function resolveDocsPath() {
  const scriptDir = path.dirname(
    decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  );
  return path.join(scriptDir, "..", "docs", "products", "ERA-Construction-Pilot-Anket-AZ.docx");
}

const docsPath = resolveDocsPath();
fs.mkdirSync(path.dirname(docsPath), { recursive: true });
fs.writeFileSync(outDownloads, buffer);
fs.writeFileSync(docsPath, buffer);
console.log("Wrote:", outDownloads);
console.log("Wrote:", docsPath);
console.log("Bytes:", buffer.length);
