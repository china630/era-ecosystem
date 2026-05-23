const fs = require('fs');
const path = require('path');

const manifestDir = path.join(__dirname, '..', 'doc', 'archive', 'manifest-notebooklm');
const consolidatedCsv = path.join(__dirname, '..', 'doc', 'nafta', 'screens-manifest.csv');
const screensDir = path.join(__dirname, '..', 'doc', 'screens');

const screenFiles = fs.readdirSync(screensDir).filter((f) => /WA\d+\.jpg$/i.test(f));
const allNums = screenFiles.map((f) => parseInt(f.match(/WA(\d+)/)[1], 10)).sort((a, b) => a - b);

const manifestFiles = fs.readdirSync(manifestDir).filter((f) => f.endsWith('.txt'));
const rows = [];
const dupes = [];

function parseLine(line, part) {
  let num = null;
  let m = line.match(/IMG-20260522-WA(\d+)\.jpg/i);
  if (m) num = parseInt(m[1], 10);
  else {
    m = line.match(/\|[^|]*WA(\d{4})[^|]*\|/i);
    if (m) num = parseInt(m[1], 10);
  }
  if (!num) return null;

  const cols = line.split('|').map((c) => c.trim().replace(/`/g, ''));
  const file = `IMG-20260522-WA${String(num).padStart(4, '0')}.jpg`;
  const isPart4 = part.includes('Часть 4');
  const screenType = (cols[5] || cols[4] || '').toLowerCase();
  const screenName = cols[4] || cols[3] || '';
  const isEmpty = screenType === 'empty' || /EMPTY/i.test(screenName) || /из меню:/i.test(cols[7] || cols[6] || '');

  return {
    num,
    file,
    part,
    module_code: cols[2] || '',
    menu_path_ru: cols[3] || '',
    screen_name: screenName,
    screen_type: screenType,
    priority: cols[9] || cols[8] || '',
    is_empty: isEmpty,
  };
}

for (const mf of manifestFiles) {
  if (mf.startsWith('Пункт')) continue; // narrative supplements
  const text = fs.readFileSync(path.join(manifestDir, mf), 'utf8');
  for (const line of text.split('\n')) {
    const entry = parseLine(line, mf);
    if (!entry) continue;
    const existing = rows.find((r) => r.num === entry.num);
    if (existing) dupes.push(entry.num);
    else rows.push(entry);
  }
}

rows.sort((a, b) => a.num - b.num);
const manifestSet = new Set(rows.map((r) => r.num));
const missing = allNums.filter((n) => !manifestSet.has(n));
const emptyRows = rows.filter((r) => r.is_empty);
const functionalRows = rows.filter((r) => !r.is_empty);

const licenseMap = {
  PMS: (r) => r.module_code === 'PMS' || /Фронт-офис|Ночной Аудит|Room Plan|брони/i.test(r.menu_path_ru),
  ChannelManager: (r) => /channel|OTA|Каналы Продаж|Booking Engine|ElektraSync/i.test(r.menu_path_ru + r.screen_name),
  POS: (r) => r.module_code === 'POS' || /POS|ресторан|F&B TERMINAL/i.test(r.menu_path_ru + r.screen_name),
  STOCK: (r) => r.module_code === 'STOCK' || /запас|склад|Продукт|Рецепт|Штрих/i.test(r.menu_path_ru + r.screen_name),
  'F&B': (r) => r.module_code === 'F&B' || /рецепт|Üretim|калькуляц/i.test(r.menu_path_ru + r.screen_name),
  ACC: (r) => r.module_code === 'ACC' || /Бухгалтер|интеграц|НДС|счет/i.test(r.menu_path_ru + r.screen_name),
  Procurement: (r) => /закуп|Procurement|Satın|Purchase/i.test(r.menu_path_ru + r.screen_name + r.module_code),
  FixedAsset: (r) => /основн|FixedAsset|Demirbaş|амортизац/i.test(r.menu_path_ru + r.screen_name),
  SPA: (r) => /SPA|Spa|процедур/i.test(r.menu_path_ru + r.screen_name + r.module_code),
  DMENU: (r) => /DMENU|цифров|Dijital|Smart Menu/i.test(r.menu_path_ru + r.screen_name),
  DoorLock: (r) => /замок|DoorLock|дверн/i.test(r.menu_path_ru + r.screen_name + r.notes),
};

const licenseUsage = {};
for (const [mod, fn] of Object.entries(licenseMap)) {
  const hits = functionalRows.filter(fn);
  licenseUsage[mod] = {
    functionalScreens: hits.length,
    emptyScreens: emptyRows.filter(fn).length,
    examples: hits.slice(0, 3).map((r) => r.file),
  };
}

const out = {
  screensOnDisk: screenFiles.length,
  manifestRows: rows.length,
  coveragePct: Math.round((rows.length / screenFiles.length) * 1000) / 10,
  functionalScreens: functionalRows.length,
  emptyScreens: emptyRows.length,
  missingCount: missing.length,
  missing,
  dupes,
  byPart: Object.fromEntries(
    manifestFiles.filter((f) => !f.startsWith('Пункт')).map((f) => [
      f,
      rows.filter((r) => r.part === f).length,
    ])
  ),
  licenseUsage,
};

fs.writeFileSync(path.join(__dirname, '..', 'doc', 'data', 'coverage-report.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
