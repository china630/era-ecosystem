/**
 * Consolidate NotebookLM manifests → single CSV/JSON + Nafta docs
 * Run: node scripts/build-nafta-docs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOC = path.join(ROOT, 'doc');
const MANIFEST_SRC = path.join(DOC, 'manifest');
const OUT = path.join(DOC, 'nafta');

const HEADERS = [
  'file',
  'wa_num',
  'module_code',
  'license_module',
  'menu_path_ru',
  'screen_name',
  'screen_type',
  'parent_screen',
  'is_empty',
  'notes',
  'priority',
  'tr_specific',
  'az_note',
  'screenshot_path',
];

const LICENSE_MAP = {
  PMS: ['PMS', 'Фронт-офис', 'Ночной Аудит', 'Room Plan', 'брони', 'KBS', 'полици'],
  ChannelManager: ['channel', 'OTA', 'Каналы Продаж', 'Booking Engine', 'ElektraSync', 'Channel Manager'],
  POS: ['^POS$', 'POS-терминал', 'Бронирования POS', 'F&B TERMINAL'],
  STOCK: ['^STOCK$', 'запас', 'склад', 'Продукт', 'Рецепт', 'Штрих', 'Stock Ending'],
  'F&B': ['^F&B$', 'Üretim', 'калькуляц'],
  ACC: ['^ACC$', 'Бухгалтер', 'интеграц', 'НДС', 'Muhasebe'],
  Procurement: ['закуп', 'Procurement', 'Satın', 'Purchase'],
  FixedAsset: ['основн', 'FixedAsset', 'Demirbaş', 'амортизац'],
  SPA: ['^SPA$', '#Spa#', 'SPA MEDIKAL'],
  DMENU: ['DMENU', 'цифров', 'Dijital', 'Smart Menu'],
  DoorLock: ['замок', 'DoorLock', 'дверн', 'дверной код'],
};

const DISABLE_RECOMMEND = {
  DMENU: { action: 'off', confidence: 'high', eur_year: 37 },
  Procurement: { action: 'off', confidence: 'high', eur_year: 214 },
  DoorLockIntegration: { action: 'off', confidence: 'high', eur_year: 214, note: 'если нет электронных замков' },
  FixedAsset: { action: 'off', confidence: 'high', eur_year: 154, note: 'если ОС в 1C/Excel' },
  SPA: { action: 'review', confidence: 'medium', eur_year: 475, note: 'нет SPA-кассы; процедуры через CRM/MED' },
  'F&B': { action: 'review', confidence: 'medium', eur_year: 307, note: 'только техкарты в импорте' },
};

function escCsv(v) {
  const s = String(v ?? '');
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseMainRow(line) {
  if (!/WA\d{4}/i.test(line)) return null;
  const m = line.match(/IMG-20260522-WA(\d+)\.jpg/i) || line.match(/\|[^|]*WA(\d{4})[^|]*\|/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const cols = line.split('|').map((c) => c.trim().replace(/`/g, ''));
  if (cols.length < 6) return null;
  const file = `IMG-20260522-WA${String(num).padStart(4, '0')}.jpg`;
  const screenName = cols[4] || '';
  const screenType = (cols[5] || '').toLowerCase();
  const notes = cols[7] || cols[6] || '';
  const isEmpty =
    screenType === 'empty' ||
    /EMPTY/i.test(screenName) ||
    /из меню:/i.test(notes);

  return {
    file,
    wa_num: num,
    module_code: cols[2] || '',
    menu_path_ru: cols[3] || '',
    screen_name: screenName,
    screen_type: screenType || (isEmpty ? 'empty' : ''),
    parent_screen: cols[6] || '',
    is_empty: isEmpty,
    notes,
    priority: cols[9] || cols[8] || '',
    tr_specific: '',
    az_note: '',
  };
}

function parseAzRow(line) {
  const m = line.match(/IMG-20260522-WA(\d+)\.jpg/i);
  if (!m) return null;
  const cols = line.split('|').map((c) => c.trim().replace(/`/g, ''));
  if (cols.length < 5) return null;
  return {
    num: parseInt(m[1], 10),
    tr_specific: cols[4] || '',
    az_note: cols[5] || '',
  };
}

function inferLicenseModule(row) {
  const blob = `${row.module_code} ${row.menu_path_ru} ${row.screen_name} ${row.notes}`;
  for (const [mod, patterns] of Object.entries(LICENSE_MAP)) {
    for (const p of patterns) {
      const re = p.startsWith('^') ? new RegExp(p, 'i') : new RegExp(p, 'i');
      if (re.test(blob)) return mod;
    }
  }
  if (row.module_code === 'CASH') return 'PMS';
  if (row.module_code === 'HK') return 'PMS';
  if (row.module_code === 'MED' || row.module_code === 'CRM') return 'PMS';
  if (row.module_code === 'REPORTS') return 'PMS';
  if (row.module_code === 'SETTINGS') return 'SETTINGS';
  return 'OTHER';
}

function loadManifestParts() {
  const rows = new Map();
  const partFiles = [
    'Манифест ТЗ (Часть 1)_ Индекс экранных форм ElektraWeb (WA0056 - WA0155).txt',
    'Screen Manifest Table (Part 2_ IMG-20260522-WA0157 to IMG-20260522-WA0255).txt',
    'Манифест ТЗ (Часть 3)_ Индексная таблица экранов WA0256 – WA0347.txt',
    'Часть 4.txt',
  ];
  for (const pf of partFiles) {
    const fp = path.join(MANIFEST_SRC, pf);
    if (!fs.existsSync(fp)) continue;
    const text = fs.readFileSync(fp, 'utf8');
    for (const line of text.split('\n')) {
      const row = parseMainRow(line);
      if (!row) continue;
      const prev = rows.get(row.wa_num);
      if (!prev || (!prev.notes && row.notes) || (prev.is_empty && !row.is_empty)) {
        rows.set(row.wa_num, row);
      }
    }
  }
  return rows;
}

function loadAzMap() {
  const az = new Map();
  const fp = path.join(MANIFEST_SRC, 'Пункт 4.txt');
  if (!fs.existsSync(fp)) return az;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const r = parseAzRow(line);
    if (r) az.set(r.num, r);
  }
  return az;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(DOC, 'data'), { recursive: true });
  fs.mkdirSync(path.join(DOC, 'reference'), { recursive: true });
  fs.mkdirSync(path.join(DOC, 'archive'), { recursive: true });

  const rowsMap = loadManifestParts();
  const azMap = loadAzMap();

  for (const [num, row] of rowsMap) {
    const az = azMap.get(num);
    if (az) {
      row.tr_specific = az.tr_specific;
      row.az_note = az.az_note;
    }
    row.license_module = inferLicenseModule(row);
    row.screenshot_path = `doc/screens/${row.file}`;
  }

  const rows = [...rowsMap.values()].sort((a, b) => a.wa_num - b.wa_num);

  const csvLines = ['\ufeff' + HEADERS.join(';')];
  for (const r of rows) {
    csvLines.push(HEADERS.map((h) => escCsv(r[h])).join(';'));
  }
  fs.writeFileSync(path.join(OUT, 'screens-manifest.csv'), csvLines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT, 'screens-manifest.json'), JSON.stringify(rows, null, 2), 'utf8');

  const screensDir = path.join(DOC, 'screens');
  const onDisk = fs.existsSync(screensDir)
    ? fs.readdirSync(screensDir).filter((f) => /WA\d+\.jpg$/i.test(f)).length
    : 0;
  const functional = rows.filter((r) => !r.is_empty).length;
  const empty = rows.filter((r) => r.is_empty).length;

  const coverage = {
    generated: new Date().toISOString().slice(0, 10),
    screensOnDisk: onDisk,
    manifestRows: rows.length,
    functionalScreens: functional,
    emptyScreens: empty,
    coveragePct: onDisk ? Math.round((rows.length / onDisk) * 1000) / 10 : 0,
    byModule: {},
    byLicenseModule: {},
    trYes: rows.filter((r) => r.tr_specific === 'yes').length,
  };
  for (const r of rows) {
    coverage.byModule[r.module_code] = (coverage.byModule[r.module_code] || 0) + 1;
    coverage.byLicenseModule[r.license_module] = (coverage.byLicenseModule[r.license_module] || 0) + 1;
  }
  fs.writeFileSync(path.join(DOC, 'data', 'coverage-report.json'), JSON.stringify(coverage, null, 2));

  writeLicenseOptimization(rows);
  copyTextDoc('Пункт 5.txt', 'business-processes.md', '# Бизнес-процессы Nafta (Elektraweb)\n\n> Источник: NotebookLM, 10 E2E сценариев.\n\n');
  copyTextDoc('Пункт 2.txt', 'supplement-pos-spa.md', '# Дополнение: POS и SPA\n\n> Операционные экраны POS/SPA в выгрузке отсутствуют.\n\n');
  copyTextDoc('Пункт 3.txt', 'supplement-stock-procurement.md', '# Дополнение: склад, закупки, DMENU, замки\n\n');

  console.log(`Manifest: ${rows.length} rows (${functional} functional, ${empty} empty)`);
  console.log(`Written: doc/nafta/screens-manifest.csv`);
  return { rows, coverage };
}

function copyTextDoc(srcName, destName, header) {
  const src = path.join(MANIFEST_SRC, srcName);
  const dest = path.join(OUT, destName);
  if (!fs.existsSync(src)) return;
  const body = fs.readFileSync(src, 'utf8').replace(/^[\s\S]*?(?=###|# )/m, '').trim();
  fs.writeFileSync(dest, `${header}\n${body}\n`, 'utf8');
}

function writeLicenseOptimization(rows) {
  const functionalByLicense = {};
  for (const r of rows.filter((x) => !x.is_empty)) {
    const lm = r.license_module;
    functionalByLicense[lm] = (functionalByLicense[lm] || 0) + 1;
  }

  const md = `# Оптимизация лицензии Elektraweb — Nafta Sanatorium

> Сгенерировано: ${new Date().toISOString().slice(0, 10)}  
> Отель: 78 номеров, Standart, факт ~5000 EUR/год, прайс API ~5860 EUR/год

## Активные модули в лицензии

PMS, ChannelManager&BookingEngine, POS, STOCK, F&B, ACC, Procurement, FixedAsset, SPA, DMENU, DoorLockIntegration

## Использование по манифесту (292 скрина)

| license_module | Рабочих экранов | Пустых | Вывод |
|----------------|-----------------|--------|-------|
${Object.entries(
    Object.groupBy(rows, (r) => r.license_module)
  )
    .sort((a, b) => b[1].length - a[1].length)
    .map(([mod, list]) => {
      const fn = list.filter((x) => !x.is_empty).length;
      const em = list.filter((x) => x.is_empty).length;
      return `| ${mod} | ${fn} | ${em} | |`;
    })
    .join('\n')}

## Рекомендации по отключению

### Смело отключить (~620 EUR/год)

| Модуль | EUR/год | Обоснование |
|--------|---------|-------------|
| **DMENU** | ~37 | Нет экранов цифрового меню |
| **Procurement** | ~214 | Нет заявок/PO; только настройки WA0321 |
| **DoorLockIntegration** | ~214 | Нет UI замков (если замки не используются) |
| **FixedAsset** | ~154 | Только импорт справочников ОС |

### Обсудить с Nafta (~780 EUR/год дополнительно)

| Модуль | EUR/год | Вопрос отелю |
|--------|---------|--------------|
| **SPA** | ~475 | Отдельная SPA-касса или только CRM + календарь WA0146? |
| **F&B** | ~307 | Себестоимость блюд в системе или только склад? |

### Не отключать

**PMS**, **Channel**, **ACC**, **CASH/Folio**, **CRM/MED**, **HK**, **POS** (минимум WA0098, WA0146, quick posting), **STOCK** (справочники; операционка не снята).

## Сценарии экономии

См. [license-scenarios.csv](license-scenarios.csv) и [license-pricing.csv](license-pricing.csv).

| Сценарий | EUR/год (API) |
|----------|---------------|
| Текущий набор | 5860 |
| Без DMENU + Procurement + Fixed + DoorLock | ~5240 |
| + без SPA + F&B | ~4460 |
| Только PMS + Channel | ~3180 |

## Файлы

- [screens-manifest.csv](screens-manifest.csv) — реестр 292 экранов
- [business-processes.md](business-processes.md) — E2E сценарии
- [supplement-pos-spa.md](supplement-pos-spa.md) — пробелы POS/SPA
- [supplement-stock-procurement.md](supplement-stock-procurement.md) — пробелы ERP
`;

  fs.writeFileSync(path.join(OUT, 'license-optimization.md'), md, 'utf8');
}

build();
