import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "..", "seed-data", "diagnostic-lab-catalog.json");
const c = JSON.parse(readFileSync(path, "utf8"));

c.version = "1.1.0";
c.notes =
  "ERA Clinic diagnostic & lab catalog v1.1 (P0+P1 AZ outpatient/sanatorium). kinds: imaging|functional|endoscopy|lab_panel|visit. packages[] = checkup compositions.";
c.commonMetaFields = [
  {
    key: "indication",
    type: "textarea",
    label: { en: "Indication", ru: "Показание", az: "Göstəriş" },
  },
  {
    key: "studyDate",
    type: "date",
    label: { en: "Study date", ru: "Дата исследования", az: "Müayinə tarixi" },
  },
  {
    key: "performer",
    type: "text",
    label: { en: "Performer", ru: "Исполнитель", az: "İcraçı" },
  },
  {
    key: "device",
    type: "text",
    label: { en: "Device", ru: "Аппарат", az: "Aparat" },
  },
  {
    key: "contrastReaction",
    type: "select",
    label: { en: "Contrast reaction", ru: "Реакция на контраст", az: "Kontrast reaksiyası" },
    options: ["none", "mild", "severe", "n/a"],
  },
  {
    key: "imagesAttached",
    type: "boolean",
    label: { en: "Images attached", ru: "Изображения приложены", az: "Şəkillər əlavə olunub" },
  },
];

const L = (en, ru, az) => ({ en, ru, az });
const f = (key, type, label, extra = {}) => ({ key, type, label, ...extra });
const conc = () =>
  f("conclusion", "textarea", L("Conclusion", "Заключение", "Nəticə"), { required: true });
const findings = () => f("findings", "textarea", L("Findings", "Описание", "Tapıntılar"));

function mod(code) {
  const m = c.modalities.find((x) => x.code === code);
  if (!m) throw new Error("missing modality " + code);
  return m;
}
function addTpl(modCode, tpl) {
  const m = mod(modCode);
  if (m.templates.some((t) => t.code === tpl.code)) return;
  m.templates.push(tpl);
}
function addLab(panel) {
  if (c.labPanels.some((p) => p.code === panel.code)) return;
  c.labPanels.push(panel);
}
function addVisit(v) {
  if (c.visitTemplates.some((x) => x.code === v.code)) return;
  c.visitTemplates.push(v);
}

// --- USG ---
addTpl("USG", {
  code: "USG-RETRO",
  category: "abdomen",
  title: L(
    "Retroperitoneal / adrenal ultrasound",
    "УЗИ забрюшинного пространства / надпочечников",
    "Retroperitoneal / adrenal USM",
  ),
  serviceCode: "USG-RETRO",
  fields: [
    f("retrospace", "textarea", L("Retroperitoneal space", "Забрюшинное пространство", "Retroperitoneal boşluq")),
    f("adrenals", "textarea", L("Adrenal glands", "Надпочечники", "Böyrəküstü vəzilər")),
    f("lymphNodes", "textarea", L("Lymph nodes", "Лимфоузлы", "Limfa düyünləri")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-PLEURA",
  category: "chest",
  title: L("Pleural ultrasound", "УЗИ плевральной полости", "Plevra USM"),
  serviceCode: "USG-PLEURA",
  fields: [
    f("rightPleura", "textarea", L("Right pleura", "Правая плевра", "Sağ plevra")),
    f("leftPleura", "textarea", L("Left pleura", "Левая плевра", "Sol plevra")),
    f("effusionMl", "text", L("Effusion estimate", "Объём выпота", "Effuziya həcmi")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-SALIV",
  category: "ent",
  title: L("Salivary glands / neck US", "УЗИ слюнных желёз / шеи", "Tüpürcək / boyun USM"),
  serviceCode: "USG-SALIV",
  fields: [
    f("region", "text", L("Region", "Область", "Zona"), { required: true }),
    findings(),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-TRUS",
  category: "andrology",
  title: L("TRUS prostate", "ТРУЗИ простаты", "Prostata TRUS"),
  serviceCode: "USG-TRUS",
  fields: [
    f("prostate", "textarea", L("Prostate", "Простата", "Prostata")),
    f("volumeMl", "number", L("Volume", "Объём", "Həcm"), { unit: "ml" }),
    f("seminalVesicles", "textarea", L("Seminal vesicles", "Семенные пузырьки", "Seminal vezikullar")),
    f("suspiciousZones", "textarea", L("Suspicious zones", "Подозрительные зоны", "Şübhəli zonalar")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-BCA",
  category: "vascular",
  title: L("BCA Doppler (carotid/vertebral)", "УЗДГ БЦА (сонные/вертебральные)", "BCA Doppler"),
  serviceCode: "USG-BCA",
  fields: [
    f("rightCarotid", "textarea", L("Right carotid", "Справа СА", "Sağ karotid")),
    f("leftCarotid", "textarea", L("Left carotid", "Слева СА", "Sol karotid")),
    f("vertebrals", "textarea", L("Vertebral arteries", "Позвоночные артерии", "Vertebral arteriyalar")),
    f("stenosisPct", "number", L("Max stenosis", "Макс. стеноз", "Maks. stenoz"), { unit: "%" }),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-VEIN-LL",
  category: "vascular",
  title: L("Lower limb veins Doppler", "УЗДГ вен нижних конечностей", "Aşağı ətraf venaları Doppler"),
  serviceCode: "USG-VEIN-LL",
  fields: [
    f("side", "select", L("Side", "Сторона", "Tərəf"), { options: ["right", "left", "both"] }),
    f("deepVeins", "textarea", L("Deep veins", "Глубокие вены", "Dərin venalar")),
    f("superficial", "textarea", L("Superficial / reflux", "Поверхностные / рефлюкс", "Səthi / reflüks")),
    f("thrombosis", "select", L("Thrombosis", "Тромбоз", "Tromboz"), {
      options: ["none", "acute", "chronic", "suspected"],
    }),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-OBST-T1",
  category: "obstetric",
  title: L("Obstetric US trimester 1", "УЗИ плода 1 триместр", "Mamalıq USM 1 trimestr"),
  serviceCode: "USG-OBST-T1",
  fields: [
    f("crlMm", "number", L("CRL", "КТР", "CRL"), { unit: "mm" }),
    f("gaWeeks", "number", L("GA", "Срок", "Müddət"), { unit: "w" }),
    f("ntMm", "number", L("NT", "ТВП", "NT"), { unit: "mm" }),
    f("heartBeat", "boolean", L("Cardiac activity", "Сердцебиение", "Ürək döyüntüsü")),
    f("chorionicity", "text", L("Chorionicity (if multiple)", "Хориальность", "Xorioniklik")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-OBST-T2",
  category: "obstetric",
  title: L("Obstetric US trimester 2 (anomaly scan)", "УЗИ плода 2 триместр (скрининг)", "Mamalıq USM 2 trimestr"),
  serviceCode: "USG-OBST-T2",
  fields: [
    f("gaWeeks", "number", L("GA", "Срок", "Müddət"), { unit: "w" }),
    f("biometry", "textarea", L("Biometry", "Биометрия", "Biometriya")),
    f("anatomy", "textarea", L("Anatomy survey", "Анатомия плода", "Döl anatomiyası")),
    f("placenta", "textarea", L("Placenta", "Плацента", "Plasenta")),
    f("amnioticFluid", "textarea", L("Amniotic fluid", "ОВод", "Döl suları")),
    f("cervixMm", "number", L("Cervix length", "Шейка матки", "Uşaqlıq boynu"), { unit: "mm" }),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-OBST-T3",
  category: "obstetric",
  title: L("Obstetric US trimester 3", "УЗИ плода 3 триместр", "Mamalıq USM 3 trimestr"),
  serviceCode: "USG-OBST-T3",
  fields: [
    f("gaWeeks", "number", L("GA", "Срок", "Müddət"), { unit: "w" }),
    f("biometry", "textarea", L("Biometry / EFW", "Биометрия / ПМП", "Biometriya / çəki")),
    f("presentation", "text", L("Presentation", "Предлежание", "Yerləşmə")),
    f("doppler", "textarea", L("Fetal Doppler", "Доплер плода", "Döl Doppler")),
    f("placenta", "textarea", L("Placenta", "Плацента", "Plasenta")),
    f("amnioticFluid", "textarea", L("AFI / MVP", "ИОЖ", "AFI")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-FOLLIC",
  category: "gyn",
  title: L("Folliculometry", "Фолликулометрия", "Follikulometriya"),
  serviceCode: "USG-FOLLIC",
  fields: [
    f("cycleDay", "number", L("Cycle day", "День цикла", "Siklin günü")),
    f("rightOvary", "textarea", L("Right ovary / follicles", "Правый яичник / фолликулы", "Sağ yumurtalıq")),
    f("leftOvary", "textarea", L("Left ovary / follicles", "Левый яичник / фолликулы", "Sol yumurtalıq")),
    f("endometriumMm", "number", L("Endometrium", "Эндометрий", "Endometrium"), { unit: "mm" }),
    f("dominantFollicleMm", "number", L("Dominant follicle", "Доминантный фолликул", "Dominant follikul"), {
      unit: "mm",
    }),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-ELASTO",
  category: "abdomen",
  title: L("Liver elastography", "Эластография печени", "Qaraciyər elastografiya"),
  serviceCode: "USG-ELASTO",
  fields: [
    f("method", "select", L("Method", "Метод", "Metod"), { options: ["2D-SWE", "pSWE", "TE", "other"] }),
    f("medianKpa", "number", L("Median stiffness", "Медиана жёсткости", "Median sərtlik"), { unit: "kPa" }),
    f("iqr", "text", L("IQR / reliability", "IQR / достоверность", "IQR")),
    f("fibrosisStage", "text", L("Suggested stage", "Предполагаемая стадия", "Mərhələ")),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-ORBIT",
  category: "ophthalmology",
  title: L("Orbit / eye ultrasound", "УЗИ глаза / орбиты", "Göz / orbit USM"),
  serviceCode: "USG-ORBIT",
  fields: [
    f("side", "select", L("Side", "Сторона", "Tərəf"), { options: ["OD", "OS", "OU"] }),
    findings(),
    conc(),
  ],
});
addTpl("USG", {
  code: "USG-NECK-LN",
  category: "soft_tissue",
  title: L("Cervical lymph nodes ultrasound", "УЗИ лимфоузлов шеи", "Boyun limfa USM"),
  serviceCode: "USG-NECK-LN",
  fields: [
    findings(),
    f("suspicious", "boolean", L("Suspicious nodes", "Подозрительные узлы", "Şübhəli düyünlər")),
    conc(),
  ],
});

// --- XR ---
addTpl("XR", {
  code: "XR-FLUORO",
  category: "chest",
  title: L("Fluorography", "Флюорография", "Flyuoroqrafiya"),
  serviceCode: "XR-FLUORO",
  fields: [
    f("projection", "select", L("Projection", "Проекция", "Proyeksiya"), { options: ["PA", "digital"] }),
    findings(),
    conc(),
  ],
});
addTpl("XR", {
  code: "XR-SKULL",
  category: "head",
  title: L("Skull / sella X-ray", "Рентген черепа / турецкого седла", "Kəllə rentgeni"),
  serviceCode: "XR-SKULL",
  fields: [findings(), conc()],
});
addTpl("XR", {
  code: "XR-OPG",
  category: "dental",
  title: L("Orthopantomogram", "Ортопантомограмма", "Ortopantomogramma"),
  serviceCode: "XR-OPG",
  fields: [findings(), conc()],
});
addTpl("XR", {
  code: "XR-FOOT",
  category: "extremity",
  title: L("Foot X-ray", "Рентген стопы", "Ayaq rentgeni"),
  serviceCode: "XR-FOOT",
  fields: [
    f("side", "select", L("Side", "Сторона", "Tərəf"), { options: ["right", "left", "both"] }),
    findings(),
    conc(),
  ],
});
addTpl("XR", {
  code: "XR-HAND",
  category: "extremity",
  title: L("Hand X-ray", "Рентген кисти", "Əl rentgeni"),
  serviceCode: "XR-HAND",
  fields: [
    f("side", "select", L("Side", "Сторона", "Tərəf"), { options: ["right", "left", "both"] }),
    findings(),
    conc(),
  ],
});

// --- CT ---
addTpl("CT", {
  code: "CT-SINUS",
  category: "ent",
  title: L("Paranasal sinuses CT", "КТ придаточных пазух", "Burun boşluqları KT"),
  serviceCode: "CT-SINUS",
  fields: [
    f("contrast", "select", L("Contrast", "Контраст", "Kontrast"), { options: ["none", "iv"] }),
    findings(),
    conc(),
  ],
});
addTpl("CT", {
  code: "CT-TMJ",
  category: "msk",
  title: L("TMJ / jaw CT", "КТ ВНЧС / челюсти", "Çənə / VNS KT"),
  serviceCode: "CT-TMJ",
  fields: [findings(), conc()],
});
addTpl("CT", {
  code: "CT-KIDNEY",
  category: "abdomen",
  title: L("Kidney CT (multiphase)", "КТ почек (фазы)", "Böyrək KT"),
  serviceCode: "CT-KIDNEY",
  fields: [f("phases", "text", L("Phases", "Фазы", "Fazalar")), findings(), conc()],
});
addTpl("CT", {
  code: "CT-CORO",
  category: "cardiac",
  title: L("Coronary CT angiography", "КТ-коронарография", "Koronar KT angio"),
  serviceCode: "CT-CORO",
  fields: [
    f("calciumScore", "number", L("Calcium score", "Кальций-скор", "Calcium score")),
    f("stenoses", "textarea", L("Coronary stenoses", "Стенозы", "Stenozlar")),
    conc(),
  ],
});

// --- MRI ---
addTpl("MRI", {
  code: "MRI-PIT",
  category: "head",
  title: L("Pituitary MRI", "МРТ гипофиза", "Hipofiz MRT"),
  serviceCode: "MRI-PIT",
  fields: [
    f("contrast", "select", L("Contrast", "Контраст", "Kontrast"), { options: ["none", "iv"] }),
    findings(),
    conc(),
  ],
});
addTpl("MRI", {
  code: "MRI-BREAST",
  category: "breast",
  title: L("Breast MRI", "МРТ молочных желёз", "Süd vəzi MRT"),
  serviceCode: "MRI-BREAST",
  fields: [
    f("birads", "select", L("BI-RADS", "BI-RADS", "BI-RADS"), {
      options: ["0", "1", "2", "3", "4", "5", "6"],
    }),
    findings(),
    conc(),
  ],
});
addTpl("MRI", {
  code: "MRI-SOFT",
  category: "msk",
  title: L("Soft tissue MRI", "МРТ мягких тканей", "Yumşaq toxuma MRT"),
  serviceCode: "MRI-SOFT",
  fields: [
    f("region", "text", L("Region", "Область", "Zona"), { required: true }),
    findings(),
    conc(),
  ],
});
addTpl("MRI", {
  code: "MRI-MRA",
  category: "vascular",
  title: L("MR angiography", "МР-ангиография", "MR angioqrafiya"),
  serviceCode: "MRI-MRA",
  fields: [
    f("territory", "text", L("Territory", "Бассейн", "Zona"), { required: true }),
    findings(),
    conc(),
  ],
});
addTpl("MRI", {
  code: "MRI-HEART",
  category: "cardiac",
  title: L("Cardiac MRI", "МРТ сердца", "Ürək MRT"),
  serviceCode: "MRI-HEART",
  fields: [
    f("function", "textarea", L("Function / volumes", "Функция / объёмы", "Funksiya")),
    f("tissue", "textarea", L("Tissue characterization", "Характеристика ткани", "Toxuma")),
    conc(),
  ],
});

// --- CARDIO ---
addTpl("CARDIO", {
  code: "STRESS-ECHO",
  category: "stress",
  title: L("Stress echocardiography", "Стресс-ЭхоКГ", "Stress ExoKQ"),
  serviceCode: "STRESS-ECHO",
  fields: [
    f("protocol", "text", L("Protocol", "Протокол", "Protokol")),
    f("restWall", "textarea", L("Rest WMA", "Покой нарушения сократимости", "İstirahət")),
    f("stressWall", "textarea", L("Stress WMA", "Нагрузка", "Yük")),
    f("lvef", "number", L("LVEF", "ФВ ЛЖ", "EF"), { unit: "%" }),
    conc(),
  ],
});
addTpl("CARDIO", {
  code: "TEE",
  category: "echo",
  title: L("Transesophageal echo", "Чреспищеводная ЭхоКГ", "TEE ExoKQ"),
  serviceCode: "TEE",
  fields: [
    f("indication", "textarea", L("Indication", "Показание", "Göstəriş")),
    findings(),
    f("thrombus", "select", L("LA appendage thrombus", "Тромб ушка ЛП", "Trombus"), {
      options: ["absent", "present", "indeterminate"],
    }),
    conc(),
  ],
});
addTpl("CARDIO", {
  code: "CORO-REPORT",
  category: "invasive",
  title: L("Coronary angiography report", "Отчёт коронарографии", "Koronaroqrafiya hesabatı"),
  serviceCode: "CORO-REPORT",
  fields: [
    f("access", "text", L("Access", "Доступ", "Giriş")),
    f("vessels", "textarea", L("Vessel lesions", "Поражения сосудов", "Damər lezyonları")),
    f("intervention", "textarea", L("PCI / stents", "Вмешательство", "Müdaxilə")),
    conc(),
  ],
});
const echo = mod("CARDIO").templates.find((t) => t.code === "ECHO-CG");
if (echo && !echo.fields.some((x) => x.key === "papMmHg")) {
  echo.fields.splice(
    echo.fields.length - 1,
    0,
    f("papMmHg", "number", L("Estimated PASP", "Расч. СДЛА", "PASP"), { unit: "mmHg" }),
    f("diastolic", "textarea", L("Diastolic function", "Диастолическая функция", "Diastolik funksiya")),
  );
}

// --- FUNC ---
addTpl("FUNC", {
  code: "SPIRO-BD",
  category: "pulmonology",
  title: L("Spirometry with bronchodilator", "Спирометрия с бронхолитиком", "Bronxodilatatorlu spirometriya"),
  serviceCode: "SPIRO-BD",
  fields: [
    f("fev1Pre", "number", L("FEV1 pre", "ОФВ1 до", "FEV1 əvvəl"), { unit: "L" }),
    f("fev1Post", "number", L("FEV1 post", "ОФВ1 после", "FEV1 sonra"), { unit: "L" }),
    f("reversibilityPct", "number", L("Reversibility", "Обратимость", "Reversibiliti"), { unit: "%" }),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "PEF",
  category: "pulmonology",
  title: L("Peak flowmetry", "Пикфлоуметрия", "Pikfloumetriya"),
  serviceCode: "PEF",
  fields: [
    f("pefBest", "number", L("Best PEF", "Лучший ПОС", "Ən yaxşı PEF")),
    f("predictedPct", "number", L("% predicted", "% от должного", "% gözlənilən")),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "TYMP",
  category: "ent",
  title: L("Tympanometry", "Тимпанометрия", "Timpanometriya"),
  serviceCode: "TYMP",
  fields: [
    f("rightEar", "textarea", L("Right", "Справа", "Sağ")),
    f("leftEar", "textarea", L("Left", "Слева", "Sol")),
    f("type", "text", L("Curve type", "Тип кривой", "Əyri tipi")),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "VEST",
  category: "ent",
  title: L("Vestibular / calorics", "Вестибулометрия", "Vestibulometriya"),
  serviceCode: "VEST",
  fields: [findings(), conc()],
});
addTpl("FUNC", {
  code: "ENT-EXAM",
  category: "ent",
  title: L("ENT exam (oto/rhino/pharyngo)", "ЛОР-осмотр", "LOR müayinə"),
  serviceCode: "ENT-EXAM",
  fields: [
    f("ears", "textarea", L("Ears", "Уши", "Qulaqlar")),
    f("nose", "textarea", L("Nose", "Нос", "Burun")),
    f("throat", "textarea", L("Throat", "Глотка/гортань", "Boru/qırtlaq")),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "COLPO",
  category: "gyn",
  title: L("Colposcopy", "Кольпоскопия", "Kolposkopiya"),
  serviceCode: "COLPO",
  fields: [
    f("acetowhite", "textarea", L("Acetowhite / iodine", "Ацетобелый / йод", "Asetobel / yod")),
    f("vessels", "textarea", L("Vascular pattern", "Сосудистый рисунок", "Damər şəkli")),
    f("biopsy", "boolean", L("Biopsy taken", "Биопсия", "Biopsiya")),
    f("schiller", "text", L("Schiller test", "Проба Шиллера", "Schiller")),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "UREA-BREATH",
  category: "gi",
  title: L("H. pylori urea breath test", "Дыхательный тест H. pylori", "H. pylori nəfəs testi"),
  serviceCode: "UREA-BREATH",
  fields: [
    f("result", "select", L("Result", "Результат", "Nəticə"), {
      options: ["negative", "positive", "indeterminate"],
    }),
    f("delta", "number", L("DOB / value", "Значение", "Dəyər")),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "EP",
  category: "neuro",
  title: L("Evoked potentials", "Вызванные потенциалы", "Yaranma potensialları"),
  serviceCode: "EP",
  fields: [
    f("modality", "select", L("Modality", "Модальность", "Modal"), {
      options: ["VEP", "AEP", "SEP", "other"],
    }),
    findings(),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "PSG",
  category: "neuro",
  title: L("Polysomnography (summary)", "Полисомнография (резюме)", "Polisomnoqrafiya"),
  serviceCode: "PSG",
  fields: [
    f("ahi", "number", L("AHI", "ИАГ", "AHI")),
    f("minSpo2", "number", L("Min SpO2", "Мин SpO2", "Min SpO2"), { unit: "%" }),
    f("sleepEfficiency", "number", L("Sleep efficiency", "Эффективность сна", "Yuxu effektivliyi"), {
      unit: "%",
    }),
    conc(),
  ],
});
addTpl("FUNC", {
  code: "STABILO",
  category: "neuro",
  title: L("Stabilometry", "Стабилометрия", "Stabilometriya"),
  serviceCode: "STABILO",
  fields: [findings(), conc()],
});

// --- ENDO ---
addTpl("ENDO", {
  code: "RRS",
  category: "gi",
  title: L("Rectosigmoidoscopy", "Ректороманоскопия", "Rektoromanoskopiya"),
  serviceCode: "RRS",
  fields: [findings(), f("biopsy", "boolean", L("Biopsy", "Биопсия", "Biopsiya")), conc()],
});
addTpl("ENDO", {
  code: "CYSTO",
  category: "urology",
  title: L("Cystoscopy", "Цистоскопия", "Sistoskopiya"),
  serviceCode: "CYSTO",
  fields: [findings(), f("biopsy", "boolean", L("Biopsy", "Биопсия", "Biopsiya")), conc()],
});
addTpl("ENDO", {
  code: "RHINO-ENDO",
  category: "ent",
  title: L("Nasal endoscopy", "Эндоскопия носа", "Burun endoskopiyası"),
  serviceCode: "RHINO-ENDO",
  fields: [findings(), conc()],
});
addTpl("ENDO", {
  code: "LARYNGO",
  category: "ent",
  title: L("Laryngoscopy", "Ларингоскопия", "Laringoskopiya"),
  serviceCode: "LARYNGO",
  fields: [findings(), conc()],
});
const colono = mod("ENDO").templates.find((t) => t.code === "COLONO");
if (colono && !colono.fields.some((x) => x.key === "polyps")) {
  colono.fields.splice(
    colono.fields.length - 1,
    0,
    f("polyps", "textarea", L("Polyps table", "Полипы (таблица)", "Poliplər")),
  );
}

// --- LAB ---
addLab({
  code: "LAB-TORCH",
  category: "serology",
  title: L("TORCH full panel", "TORCH полный", "TORCH tam"),
  serviceCode: "LAB-TORCH",
  analytes: [
    { code: "TOXO-IgG", unit: "", label: L("Toxo IgG", "Toxo IgG", "Toxo IgG") },
    { code: "TOXO-IgM", unit: "", label: L("Toxo IgM", "Toxo IgM", "Toxo IgM") },
    { code: "RUB-IgG", unit: "", label: L("Rubella IgG", "Rubella IgG", "Rubella IgG") },
    { code: "RUB-IgM", unit: "", label: L("Rubella IgM", "Rubella IgM", "Rubella IgM") },
    { code: "CMV-IgG", unit: "", label: L("CMV IgG", "CMV IgG", "CMV IgG") },
    { code: "CMV-IgM", unit: "", label: L("CMV IgM", "CMV IgM", "CMV IgM") },
    { code: "HSV1-IgG", unit: "", label: L("HSV-1 IgG", "HSV-1 IgG", "HSV-1 IgG") },
    { code: "HSV1-IgM", unit: "", label: L("HSV-1 IgM", "HSV-1 IgM", "HSV-1 IgM") },
    { code: "HSV2-IgG", unit: "", label: L("HSV-2 IgG", "HSV-2 IgG", "HSV-2 IgG") },
    { code: "HSV2-IgM", unit: "", label: L("HSV-2 IgM", "HSV-2 IgM", "HSV-2 IgM") },
    { code: "PARVO-IgG", unit: "", label: L("Parvo B19 IgG", "Parvo B19 IgG", "Parvo B19 IgG") },
    { code: "PARVO-IgM", unit: "", label: L("Parvo B19 IgM", "Parvo B19 IgM", "Parvo B19 IgM") },
  ],
});
addLab({
  code: "LAB-HEP-EXT",
  category: "serology",
  title: L("Hepatitis extended", "Гепатиты расширенно", "Hepatit geniş"),
  serviceCode: "LAB-HEP-EXT",
  analytes: [
    { code: "HBsAg", unit: "", label: L("HBsAg", "HBsAg", "HBsAg") },
    { code: "Anti-HBs", unit: "", label: L("Anti-HBs", "Anti-HBs", "Anti-HBs") },
    { code: "Anti-HBc", unit: "", label: L("Anti-HBc total", "Anti-HBc", "Anti-HBc") },
    { code: "HBeAg", unit: "", label: L("HBeAg", "HBeAg", "HBeAg") },
    { code: "Anti-HBe", unit: "", label: L("Anti-HBe", "Anti-HBe", "Anti-HBe") },
    { code: "HAV-IgM", unit: "", label: L("Anti-HAV IgM", "Anti-HAV IgM", "Anti-HAV IgM") },
    { code: "HAV-IgG", unit: "", label: L("Anti-HAV IgG", "Anti-HAV IgG", "Anti-HAV IgG") },
    { code: "Anti-HCV", unit: "", label: L("Anti-HCV", "Anti-HCV", "Anti-HCV") },
    { code: "HCV-RNA", unit: "", label: L("HCV RNA", "HCV RNA", "HCV RNA") },
    { code: "HBV-DNA", unit: "", label: L("HBV DNA", "HBV DNA", "HBV DNA") },
  ],
});
addLab({
  code: "LAB-ALLERGY-FOOD",
  category: "allergy",
  title: L("Food allergy IgE panel", "Аллергопанель пищевая", "Qida allergiya paneli"),
  serviceCode: "LAB-ALLERGY-FOOD",
  analytes: [
    { code: "IGE-TOT", unit: "IU/mL", label: L("Total IgE", "Общий IgE", "Ümumi IgE") },
    { code: "IGE-MILK", unit: "", label: L("Milk", "Молоко", "Süd") },
    { code: "IGE-EGG", unit: "", label: L("Egg", "Яйцо", "Yumurta") },
    { code: "IGE-WHEAT", unit: "", label: L("Wheat", "Пшеница", "Buğda") },
    { code: "IGE-PEANUT", unit: "", label: L("Peanut", "Арахис", "Fıstıq") },
    { code: "IGE-FISH", unit: "", label: L("Fish", "Рыба", "Balıq") },
    { code: "IGE-SOY", unit: "", label: L("Soy", "Соя", "Soya") },
    { code: "IGE-FOOD-NOTE", unit: "", label: L("Other / comment", "Прочее", "Digər") },
  ],
});
addLab({
  code: "LAB-ALLERGY-INH",
  category: "allergy",
  title: L("Inhalant allergy IgE panel", "Аллергопанель дыхательная", "İnhalyasiya allergiya"),
  serviceCode: "LAB-ALLERGY-INH",
  analytes: [
    { code: "IGE-TOT", unit: "IU/mL", label: L("Total IgE", "Общий IgE", "Ümumi IgE") },
    { code: "IGE-DUST", unit: "", label: L("House dust mite", "Клещ домашней пыли", "Ev tozu gənəsi") },
    { code: "IGE-CAT", unit: "", label: L("Cat", "Кошка", "Pişik") },
    { code: "IGE-DOG", unit: "", label: L("Dog", "Собака", "İt") },
    { code: "IGE-POLLEN-TREE", unit: "", label: L("Tree pollen", "Пыльца деревьев", "Ağac poleni") },
    { code: "IGE-POLLEN-GRASS", unit: "", label: L("Grass pollen", "Пыльца трав", "Ot poleni") },
    { code: "IGE-MOLD", unit: "", label: L("Mold", "Плесень", "Kif") },
  ],
});
addLab({
  code: "LAB-ALLERGY-PED",
  category: "allergy",
  title: L("Pediatric allergy panel", "Аллергопанель педиатрическая", "Pediatrik allergiya"),
  serviceCode: "LAB-ALLERGY-PED",
  analytes: [
    { code: "IGE-TOT", unit: "IU/mL", label: L("Total IgE", "Общий IgE", "Ümumi IgE") },
    { code: "IGE-MILK", unit: "", label: L("Milk", "Молоко", "Süd") },
    { code: "IGE-EGG", unit: "", label: L("Egg", "Яйцо", "Yumurta") },
    { code: "IGE-DUST", unit: "", label: L("Dust mite", "Клещ", "Gənə") },
    { code: "IGE-PED-NOTE", unit: "", label: L("Panel comment", "Комментарий", "Şərh") },
  ],
});
addLab({
  code: "LAB-RHEUMA",
  category: "rheumatology",
  title: L("Rheumatology panel", "Ревмопанель", "Revmo panel"),
  serviceCode: "LAB-RHEUMA",
  analytes: [
    { code: "RF", unit: "IU/mL", label: L("Rheumatoid factor", "РФ", "RF") },
    { code: "ACCP", unit: "U/mL", label: L("Anti-CCP", "Anti-CCP", "Anti-CCP") },
    { code: "ANA", unit: "", label: L("ANA", "ANA", "ANA") },
    { code: "ANCA", unit: "", label: L("ANCA", "ANCA", "ANCA") },
    { code: "ASO", unit: "IU/mL", label: L("ASO", "АСЛО", "ASO") },
    { code: "C3", unit: "g/L", label: L("C3", "C3", "C3") },
    { code: "C4", unit: "g/L", label: L("C4", "C4", "C4") },
    { code: "CRP", unit: "mg/L", label: L("CRP", "СРБ", "CRP") },
  ],
});
addLab({
  code: "LAB-INFLAM",
  category: "inflammation",
  title: L("Inflammation markers", "Маркёры воспаления", "İltihab markerləri"),
  serviceCode: "LAB-INFLAM",
  analytes: [
    { code: "CRP", unit: "mg/L", label: L("CRP", "СРБ", "CRP"), refMin: "0", refMax: "5" },
    { code: "PCT", unit: "ng/mL", label: L("Procalcitonin", "Прокальцитонин", "Prokalsitonin") },
    { code: "IL6", unit: "pg/mL", label: L("IL-6", "ИЛ-6", "IL-6") },
    { code: "FERR", unit: "ng/mL", label: L("Ferritin", "Ферритин", "Ferritin") },
    { code: "ESR", unit: "mm/h", label: L("ESR", "СОЭ", "ECŞ") },
  ],
});
addLab({
  code: "LAB-RENAL",
  category: "biochemistry",
  title: L("Renal extended", "Почки расширенно", "Böyrək geniş"),
  serviceCode: "LAB-RENAL",
  analytes: [
    { code: "CREA", unit: "µmol/L", label: L("Creatinine", "Креатинин", "Kreatinin") },
    { code: "UREA", unit: "mmol/L", label: L("Urea", "Мочевина", "Karbamid") },
    { code: "CYSC", unit: "mg/L", label: L("Cystatin C", "Цистатин C", "Sistatin C") },
    { code: "EGFR", unit: "mL/min", label: L("eGFR", "рСКФ", "eGFR") },
    { code: "UACR", unit: "mg/g", label: L("Albumin/creatinine urine", "МАУ/креатинин", "UACR") },
    { code: "UPRO-24", unit: "g/day", label: L("24h protein", "Суточный белок мочи", "24s zülal") },
  ],
});
addLab({
  code: "LAB-LIPID",
  category: "biochemistry",
  title: L("Lipid panel", "Липидограмма", "Lipid panel"),
  serviceCode: "LAB-LIPID",
  analytes: [
    { code: "CHOL", unit: "mmol/L", label: L("Cholesterol", "Холестерин", "Xolesterol") },
    { code: "HDL", unit: "mmol/L", label: L("HDL", "ЛПВП", "HDL") },
    { code: "LDL", unit: "mmol/L", label: L("LDL", "ЛПНП", "LDL") },
    { code: "TRIG", unit: "mmol/L", label: L("Triglycerides", "Триглицериды", "Triqliseridlər") },
    { code: "APOB", unit: "g/L", label: L("ApoB", "ApoB", "ApoB") },
    { code: "LPA", unit: "nmol/L", label: L("Lp(a)", "Lp(a)", "Lp(a)") },
  ],
});
addLab({
  code: "LAB-LIVER",
  category: "biochemistry",
  title: L("Liver panel", "Печёночная панель", "Qaraciyər paneli"),
  serviceCode: "LAB-LIVER",
  analytes: [
    { code: "ALT", unit: "U/L", label: L("ALT", "АЛТ", "ALT") },
    { code: "AST", unit: "U/L", label: L("AST", "АСТ", "AST") },
    { code: "GGT", unit: "U/L", label: L("GGT", "ГГТ", "GGT") },
    { code: "ALP", unit: "U/L", label: L("ALP", "ЩФ", "ALP") },
    { code: "TBIL", unit: "µmol/L", label: L("Total bilirubin", "Билирубин общ.", "Ümumi bilirubin") },
    { code: "DBIL", unit: "µmol/L", label: L("Direct bilirubin", "Билирубин пр.", "Birbaşa bilirubin") },
    { code: "TP", unit: "g/L", label: L("Total protein", "Белок", "Zülal") },
    { code: "ALB", unit: "g/L", label: L("Albumin", "Альбумин", "Albumin") },
  ],
});
addLab({
  code: "LAB-CARDIAC",
  category: "cardiac",
  title: L("Cardiac markers", "Кардиомаркёры", "Kardiomarkerlər"),
  serviceCode: "LAB-CARDIAC",
  analytes: [
    { code: "TNI", unit: "ng/mL", label: L("Troponin I/T", "Тропонин", "Troponin") },
    { code: "CKMB", unit: "ng/mL", label: L("CK-MB", "КК-МБ", "CK-MB") },
    { code: "MYO", unit: "ng/mL", label: L("Myoglobin", "Миоглобин", "Mioglobin") },
    { code: "NTPROBNP", unit: "pg/mL", label: L("NT-proBNP", "NT-proBNP", "NT-proBNP") },
    { code: "BNP", unit: "pg/mL", label: L("BNP", "BNP", "BNP") },
  ],
});
addLab({
  code: "LAB-ENDO-HORM",
  category: "hormones",
  title: L("Endocrine hormones extras", "Гормоны (доп. эндокринные)", "Endokrin hormonlar"),
  serviceCode: "LAB-ENDO-HORM",
  analytes: [
    { code: "CORT", unit: "nmol/L", label: L("Cortisol", "Кортизол", "Kortizol") },
    { code: "ACTH", unit: "pg/mL", label: L("ACTH", "АКТГ", "ACTH") },
    { code: "PTH", unit: "pg/mL", label: L("PTH", "ПТГ", "PTH") },
    { code: "DHEAS", unit: "µg/dL", label: L("DHEA-S", "ДГЭА-С", "DHEA-S") },
    { code: "OHP17", unit: "ng/mL", label: L("17-OHP", "17-OHP", "17-OHP") },
    { code: "INHIBINB", unit: "pg/mL", label: L("Inhibin B", "Ингибин B", "İnhibin B") },
    { code: "IGF1", unit: "ng/mL", label: L("IGF-1", "ИФР-1", "IGF-1") },
  ],
});
addLab({
  code: "LAB-MICRO-CULT",
  category: "microbiology",
  title: L("Culture + antibiogram (generic)", "Посев + антибиотикограмма", "Əkmə + antibioqram"),
  serviceCode: "LAB-MICRO-CULT",
  analytes: [
    { code: "MC-SITE", unit: "", label: L("Site", "Локус", "Lokus") },
    { code: "MC-GROWTH", unit: "CFU/mL", label: L("Growth", "Рост", "Böyümə") },
    { code: "MC-ORG", unit: "", label: L("Organism", "Возбудитель", "Törədici") },
    { code: "MC-SENS", unit: "", label: L("Sensitivity", "Чувствительность", "Həssaslıq") },
  ],
});
addLab({
  code: "LAB-COPROG",
  category: "stool",
  title: L("Coprogram", "Копрограмма", "Koproqramma"),
  serviceCode: "LAB-COPROG",
  analytes: [
    { code: "CP-CONS", unit: "", label: L("Consistency", "Консистенция", "Konsistensiyа") },
    { code: "CP-COLOR", unit: "", label: L("Color", "Цвет", "Rəng") },
    { code: "CP-MUSCLE", unit: "", label: L("Muscle fibers", "Мышечные волокна", "Əzələ lifləri") },
    { code: "CP-FAT", unit: "", label: L("Fat", "Жир", "Yağ") },
    { code: "CP-STARCH", unit: "", label: L("Starch", "Крахмал", "Nişasta") },
    { code: "CP-WBC", unit: "", label: L("Leukocytes", "Лейкоциты", "Leykositlər") },
    { code: "S-ELAST", unit: "µg/g", label: L("Pancreatic elastase", "Эластаза", "Elastaza") },
  ],
});
addLab({
  code: "LAB-GYN-SMEAR",
  category: "cytology",
  title: L("Vaginal flora smear", "Мазок на флору", "Flora yaxması"),
  serviceCode: "LAB-GYN-SMEAR",
  analytes: [
    { code: "GS-WBC", unit: "", label: L("WBC", "Лейкоциты", "Leykositlər") },
    { code: "GS-EPI", unit: "", label: L("Epithelium", "Эпителий", "Epiteli") },
    { code: "GS-FLORA", unit: "", label: L("Flora", "Флора", "Flora") },
    { code: "GS-CLEAN", unit: "", label: L("Purity grade", "Степень чистоты", "Təmizlik dərəcəsi") },
    { code: "GS-TRICH", unit: "", label: L("Trichomonas", "Трихомонады", "Trichomonas") },
    { code: "GS-CAND", unit: "", label: L("Candida", "Кандида", "Candida") },
  ],
});
addLab({
  code: "LAB-HPV",
  category: "molecular",
  title: L("HPV high-risk genotyping", "ВПЧ (генотипы ВР)", "HPV yüksək risk"),
  serviceCode: "LAB-HPV",
  analytes: [
    { code: "HPV-16", unit: "", label: L("HPV-16", "HPV-16", "HPV-16") },
    { code: "HPV-18", unit: "", label: L("HPV-18", "HPV-18", "HPV-18") },
    { code: "HPV-OTHER-HR", unit: "", label: L("Other high-risk", "Другие ВР", "Digər YR") },
    { code: "HPV-COMMENT", unit: "", label: L("Comment", "Комментарий", "Şərh") },
  ],
});
addLab({
  code: "LAB-RESP-PCR",
  category: "molecular",
  title: L("Respiratory PCR (COVID/Flu/RSV)", "ПЦР респираторная", "Respirator PCR"),
  serviceCode: "LAB-RESP-PCR",
  analytes: [
    { code: "SARS-COV2", unit: "", label: L("SARS-CoV-2", "SARS-CoV-2", "SARS-CoV-2") },
    { code: "FLU-A", unit: "", label: L("Influenza A", "Грипп A", "Qrip A") },
    { code: "FLU-B", unit: "", label: L("Influenza B", "Грипп B", "Qrip B") },
    { code: "RSV", unit: "", label: L("RSV", "RSV", "RSV") },
  ],
});
addLab({
  code: "LAB-TUMOR-EXT",
  category: "tumor_markers",
  title: L("Tumor markers extended", "Онкомаркеры расширенные", "Onkomarker geniş"),
  serviceCode: "LAB-TUMOR-EXT",
  analytes: [
    { code: "PSA", unit: "ng/mL", label: L("PSA total", "ПСА общ.", "PSA") },
    { code: "FPSA", unit: "ng/mL", label: L("Free PSA", "ПСА свободный", "Sərbəst PSA") },
    { code: "PSARATIO", unit: "%", label: L("Free/total %", "% своб./общ.", "% sərbəst") },
    { code: "HE4", unit: "pmol/L", label: L("HE4", "HE4", "HE4") },
    { code: "CYFRA", unit: "ng/mL", label: L("CYFRA 21-1", "CYFRA 21-1", "CYFRA") },
    { code: "NSE", unit: "ng/mL", label: L("NSE", "NSE", "NSE") },
    { code: "SCC", unit: "ng/mL", label: L("SCC", "SCC", "SCC") },
    { code: "S100", unit: "µg/L", label: L("S100", "S100", "S100") },
  ],
});
addLab({
  code: "LAB-IG",
  category: "immunology",
  title: L("Immunoglobulins", "Иммуноглобулины", "İmmunoqlobulinlər"),
  serviceCode: "LAB-IG",
  analytes: [
    { code: "IGA", unit: "g/L", label: L("IgA", "IgA", "IgA") },
    { code: "IGM", unit: "g/L", label: L("IgM", "IgM", "IgM") },
    { code: "IGG", unit: "g/L", label: L("IgG", "IgG", "IgG") },
    { code: "IGE-TOT", unit: "IU/mL", label: L("IgE total", "IgE общ.", "IgE") },
  ],
});
addLab({
  code: "LAB-HOMOC",
  category: "metabolic",
  title: L("Homocysteine", "Гомоцистеин", "Homosistein"),
  serviceCode: "LAB-HOMOC",
  analytes: [{ code: "HCY", unit: "µmol/L", label: L("Homocysteine", "Гомоцистеин", "Homosistein") }],
});
addLab({
  code: "LAB-TRACE",
  category: "vitamins_iron",
  title: L("Trace elements", "Микроэлементы", "Mikroelementlər"),
  serviceCode: "LAB-TRACE",
  analytes: [
    { code: "ZN", unit: "µmol/L", label: L("Zinc", "Цинк", "Sink") },
    { code: "CU", unit: "µmol/L", label: L("Copper", "Медь", "Mis") },
    { code: "SE", unit: "µg/L", label: L("Selenium", "Селен", "Selen") },
    { code: "B1", unit: "", label: L("Vitamin B1", "Витамин B1", "Vitamin B1") },
    { code: "B6", unit: "", label: L("Vitamin B6", "Витамин B6", "Vitamin B6") },
  ],
});
addLab({
  code: "LAB-INFECT-REG",
  category: "serology",
  title: L("Regional infections", "Региональные инфекции", "Regional infeksiyalar"),
  serviceCode: "LAB-INFECT-REG",
  analytes: [
    { code: "EBV-VCA-IgG", unit: "", label: L("EBV VCA IgG", "EBV VCA IgG", "EBV VCA IgG") },
    { code: "EBV-VCA-IgM", unit: "", label: L("EBV VCA IgM", "EBV VCA IgM", "EBV VCA IgM") },
    { code: "HP-IgG", unit: "", label: L("H. pylori IgG", "H. pylori IgG", "H. pylori IgG") },
    { code: "MP-IgM", unit: "", label: L("M. pneumoniae IgM", "M. pneumoniae IgM", "M. pneumoniae IgM") },
    { code: "CP-IgM", unit: "", label: L("C. pneumoniae IgM", "C. pneumoniae IgM", "C. pneumoniae IgM") },
    { code: "BRUCELLA", unit: "", label: L("Brucella Ab", "Бруцеллёз Ab", "Brusellyoz") },
    { code: "WIDAL", unit: "", label: L("Widal / typhoid", "Видаль / брюшной тиф", "Vidal / tif") },
  ],
});
addLab({
  code: "LAB-TB-IGRA",
  category: "serology",
  title: L("TB IGRA (Quantiferon)", "Туберкулёз IGRA", "Vərəm IGRA"),
  serviceCode: "LAB-TB-IGRA",
  analytes: [
    { code: "IGRA-RESULT", unit: "", label: L("Result", "Результат", "Nəticə") },
    { code: "IGRA-NIL", unit: "", label: L("Nil", "Nil", "Nil") },
    { code: "IGRA-MITOGEN", unit: "", label: L("Mitogen", "Mitogen", "Mitogen") },
    { code: "IGRA-TB", unit: "", label: L("TB antigen", "TB Ag", "TB Ag") },
  ],
});
addLab({
  code: "LAB-DRUG-SCR",
  category: "toxicology",
  title: L("Drug screen", "Наркоскрининг", "Narkoskrining"),
  serviceCode: "LAB-DRUG-SCR",
  analytes: [
    { code: "DS-PANEL", unit: "", label: L("Panel result", "Результат панели", "Panel nəticəsi") },
    { code: "DS-COMMENT", unit: "", label: L("Comment", "Комментарий", "Şərh") },
  ],
});
addLab({
  code: "LAB-SPUTUM",
  category: "microbiology",
  title: L("Sputum analysis", "Анализ мокроты", "Bəlğəm analizi"),
  serviceCode: "LAB-SPUTUM",
  analytes: [
    { code: "SP-APPEAR", unit: "", label: L("Appearance", "Характер", "Görünüş") },
    { code: "SP-WBC", unit: "", label: L("WBC", "Лейкоциты", "Leykositlər") },
    { code: "SP-AFB", unit: "", label: L("AFB / BK", "БК", "BK") },
    { code: "SP-CULT", unit: "", label: L("Culture", "Посев", "Əkmə") },
  ],
});

// visits
const visitFieldsBase = () => [
  f("complaint", "textarea", L("Complaint", "Жалоба", "Şikayət"), { required: true }),
  f("anamnesis", "textarea", L("Anamnesis", "Анамнез", "Anamnez")),
  f("exam", "textarea", L("Exam", "Осмотр", "Müayinə")),
  f("diagnosis", "textarea", L("Diagnosis", "Диагноз", "Diaqnoz")),
  f("plan", "textarea", L("Plan", "План", "Plan")),
];
addVisit({
  code: "GYN-VISIT",
  specialty: "GYN",
  title: L("Gynecology visit", "Гинекологический приём", "Ginekoloji qəbul"),
  fields: [
    ...visitFieldsBase(),
    f("lmp", "date", L("LMP", "Дата ПМ", "SAG")),
    f("pelvicExam", "textarea", L("Pelvic exam", "Гинекологический статус", "Ginekoloji status")),
  ],
});
addVisit({
  code: "PED-VISIT",
  specialty: "PED",
  title: L("Pediatrics visit", "Педиатрический приём", "Pediatrik qəbul"),
  fields: [
    ...visitFieldsBase(),
    f("weightKg", "number", L("Weight", "Вес", "Çəki"), { unit: "kg" }),
    f("heightCm", "number", L("Height", "Рост", "Boy"), { unit: "cm" }),
    f("vaccinesNote", "textarea", L("Vaccines note", "Прививки", "Peyvəndlər")),
  ],
});
addVisit({
  code: "ENT-VISIT",
  specialty: "ENT",
  title: L("ENT visit", "ЛОР-приём", "LOR qəbul"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "NEURO-VISIT",
  specialty: "NEURO",
  title: L("Neurology visit", "Неврологический приём", "Nevroloji qəbul"),
  fields: [
    ...visitFieldsBase(),
    f("neuroStatus", "textarea", L("Neuro status", "Неврологический статус", "Nevroloji status")),
  ],
});
addVisit({
  code: "ENDO-VISIT",
  specialty: "ENDOCRINE",
  title: L("Endocrinology visit", "Эндокринологический приём", "Endokrinoloji qəbul"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "URO-VISIT",
  specialty: "URO",
  title: L("Urology visit", "Урологический приём", "Uroloji qəbul"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "DERM-VISIT",
  specialty: "DERM",
  title: L("Dermatology visit", "Дерматологический приём", "Dermatoloji qəbul"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "PULM-VISIT",
  specialty: "PULM",
  title: L("Pulmonology visit", "Пульмонологический приём", "Pulmonoloji qəbul"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "ORTHO-VISIT",
  specialty: "ORTHO",
  title: L("Ortho / trauma visit", "Ортопедия / травма", "Ortopediya / travma"),
  fields: visitFieldsBase(),
});
addVisit({
  code: "CHECKUP-VISIT",
  specialty: "GP",
  title: L("Check-up visit", "Приём чекап", "Check-up qəbul"),
  fields: [
    f("complaint", "textarea", L("Goals / complaints", "Цели / жалобы", "Məqsəd / şikayət")),
    f("riskFactors", "textarea", L("Risk factors", "Факторы риска", "Risk faktorları")),
    f("orderedPack", "text", L("Package code", "Код пакета", "Paket kodu")),
    f("summary", "textarea", L("Summary", "Резюме", "Xülasə")),
    f("plan", "textarea", L("Plan", "План", "Plan")),
  ],
});
addVisit({
  code: "SANATORIUM-INTAKE",
  specialty: "SANATORIUM",
  title: L("Sanatorium intake exam", "Санаторный первичный осмотр", "Sanatoriya ilkin müayinə"),
  fields: [
    f("complaint", "textarea", L("Complaint", "Жалоба", "Şikayət"), { required: true }),
    f("contra", "textarea", L("Contraindications", "Противопоказания", "Əks göstərişlər")),
    f("vitals", "textarea", L("Vitals", "Витальные", "Vital")),
    f("programHint", "text", L("Program suggestion", "Рекомендуемая программа", "Proqram")),
    f("diagnosis", "textarea", L("Diagnosis", "Диагноз", "Diaqnoz")),
    f("plan", "textarea", L("Treatment plan", "План лечения", "Müalicə planı")),
  ],
});

c.packages = [
  {
    code: "PKG-BASIC",
    title: L("Check-up Basic", "Чекап базовый", "Check-up Basic"),
    includes: ["LAB-CBC", "LAB-BIOCHEM", "LAB-URINE", "ECG-12", "XR-FLUORO"],
  },
  {
    code: "PKG-WOMAN",
    title: L("Check-up Woman", "Чекап женский", "Check-up Women"),
    includes: [
      "LAB-CBC",
      "LAB-BIOCHEM",
      "LAB-THYROID",
      "LAB-URINE",
      "USG-PELVIC",
      "USG-BREAST",
      "LAB-GYN-SMEAR",
      "LAB-CYTOLOGY",
    ],
  },
  {
    code: "PKG-MAN",
    title: L("Check-up Man", "Чекап мужской", "Check-up Men"),
    includes: ["LAB-CBC", "LAB-BIOCHEM", "LAB-LIPID", "LAB-URINE", "USG-ABD", "USG-PROSTATE", "ECG-12"],
  },
  {
    code: "PKG-SENIOR",
    title: L("Check-up Senior", "Чекап 50+", "Check-up 50+"),
    includes: [
      "LAB-CBC",
      "LAB-BIOCHEM",
      "LAB-LIPID",
      "LAB-GLUCOSE",
      "LAB-CARDIAC",
      "ECG-12",
      "ECHO-CG",
      "USG-ABD",
      "XR-FLUORO",
    ],
  },
  {
    code: "PKG-PREOP",
    title: L("Pre-operative pack", "Предоперационный пакет", "Preop paket"),
    includes: ["LAB-CBC", "LAB-COAG", "LAB-GLUCOSE", "LAB-BG", "LAB-INFECT", "ECG-12", "XR-CHEST"],
  },
  {
    code: "PKG-EMPLOY",
    title: L("Employment / occupancy screen", "Профосмотр", "Peşə müayinəsi"),
    includes: ["LAB-CBC", "LAB-URINE", "LAB-INFECT", "XR-FLUORO", "ECG-12", "OPHTH-DX", "ENT-EXAM"],
  },
  {
    code: "PKG-SAN-ADM",
    title: L("Sanatorium admission", "Поступление в санаторий", "Sanatoriya qəbul"),
    includes: ["LAB-CBC", "LAB-BIOCHEM", "LAB-URINE", "ECG-12", "XR-FLUORO", "SANATORIUM-INTAKE"],
  },
];

writeFileSync(path, JSON.stringify(c, null, 2) + "\n");
const mods = c.modalities.reduce((n, m) => n + m.templates.length, 0);
const analytes = c.labPanels.reduce((n, p) => n + p.analytes.length, 0);
console.log(
  JSON.stringify(
    {
      version: c.version,
      modalities: c.modalities.length,
      templates: mods,
      labPanels: c.labPanels.length,
      analytes,
      visits: c.visitTemplates.length,
      packages: c.packages.length,
    },
    null,
    2,
  ),
);
