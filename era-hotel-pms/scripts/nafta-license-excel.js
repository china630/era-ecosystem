/**
 * Nafta Sanatorium — расчёт лицензии Elektraweb (1 год, 78 номеров)
 * Output: doc/nafta-license-pricing.csv + doc/nafta-license-optimization.csv
 */
const fs = require('fs');
const path = require('path');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'doc', 'data', 'price_product.json'), 'utf8')
).ResultSets[0];
const byCode = {};
products.forEach((p) => { if (p.CODE) byCode[p.CODE] = p; });

const HOTEL = {
  name: 'Nafta Sanatorium Hotel',
  rooms: 78,
  period: '11.06.2025 — 11.06.2026',
  package: 'Standart',
  packetFactor: 1,
  periodFactor: 1,
  actualPaidEur: 5000,
};

const ACTIVE = [
  { code: 'PMS', label: 'PMS (Ön Büro)', essential: true },
  { code: 'ChannelManager&BookingEngine', label: 'Channel Manager + Online Booking', essential: true },
  { code: 'POS', label: 'POS (Restoran)', essential: false, userPriceQty: 1 },
  { code: 'STOCK', label: 'Stok (Склад)', essential: false },
  { code: 'F&B', label: 'F&B / Üretim (Рецептуры)', essential: false },
  { code: 'ACC', label: 'Muhasebe (Бухгалтерия)', essential: false },
  { code: 'Procurement', label: 'Satın Alma (Закупки)', essential: false },
  { code: 'FixedAsset', label: 'Demirbaş (Основные средства)', essential: false },
  { code: 'SPA', label: 'SPA', essential: false, userPriceQty: 1 },
  { code: 'DMENU', label: 'Digital Menu (базовый)', essential: false },
  { code: 'DoorLockIntegration', label: 'Door Lock Integration', essential: false },
];

function calc(p, opts = {}) {
  const rooms = opts.rooms ?? HOTEL.rooms;
  const pkt = opts.packetFactor ?? HOTEL.packetFactor;
  const s = opts.usePacketFactor !== false && p.USEFACTOR ? pkt : 1;
  let roomPart = rooms * (p.ROOMPRICE || 0) * s;
  if (p.MINPRICE != null && roomPart < p.MINPRICE) roomPart = p.MINPRICE;
  const userQty = opts.userPriceQty ?? 1;
  const userPart = (p.USERPRICE || 0) * userQty;
  const base = p.BASEPRICE || 0;
  const monthly = roomPart + userPart + base;
  const annual = 12 * monthly * (opts.periodFactor ?? HOTEL.periodFactor);
  const install = (p.INSTALLATIONFEE || 0) * (opts.qty || 1);
  return {
    roomPart: round(roomPart),
    userPart: round(userPart),
    base: round(base),
    monthly: round(monthly),
    annual: round(annual),
    install: round(install),
    formula: buildFormula(p, rooms, s, roomPart, userPart, base, userQty),
  };
}

function round(n) { return Math.round(n * 100) / 100; }

function buildFormula(p, rooms, s, roomPart, userPart, base, userQty) {
  const parts = [];
  if (p.USEFACTOR && p.ROOMPRICE) parts.push(`${rooms}×${p.ROOMPRICE}×${s}`);
  else if (p.ROOMPRICE) parts.push(`${rooms}×${p.ROOMPRICE}`);
  if (p.MINPRICE && roomPart === p.MINPRICE) parts.push(`min ${p.MINPRICE}`);
  if (userPart) parts.push(`${p.USERPRICE}×${userQty} user`);
  if (base) parts.push(`base ${base}`);
  return parts.join(' + ') || 'fixed';
}

function escCsv(v) {
  const s = String(v ?? '');
  return s.includes(';') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, headers) {
  const lines = ['\ufeff' + headers.map(escCsv).join(';')];
  rows.forEach((r) => lines.push(headers.map((h) => escCsv(r[h])).join(';')));
  return lines.join('\r\n');
}

// --- Main breakdown ---
const breakdown = [];
let sumAnnual = 0;
let sumInstall = 0;

ACTIVE.forEach((item, i) => {
  const p = byCode[item.code];
  if (!p) return;
  const c = calc(p, { userPriceQty: item.userPriceQty ?? 1 });
  sumAnnual += c.annual;
  sumInstall += c.install;
  const pct = 0; // filled later
  breakdown.push({
    '№': i + 1,
    'Модуль (лицензия)': item.label,
    'CODE': item.code,
    'EUR/номер/мес': p.ROOMPRICE ?? '—',
    'BASE EUR/мес': p.BASEPRICE ?? 0,
    'MIN EUR/мес': p.MINPRICE ?? '—',
    'USER EUR/ед./мес': p.USERPRICE || 0,
    'Кол-во USER': item.userPriceQty ?? 0,
    'Формула (мес.)': c.formula,
    'EUR/мес': c.monthly,
    'EUR/год': c.annual,
    'Install EUR': c.install,
    'EUR/год+install': c.annual + c.install,
    '% от итога': '',
    'Обязательный?': item.essential ? 'Да' : 'Нет',
    'Комментарий': comment(item.code, c),
  });
});

breakdown.forEach((r) => {
  r['% от итога'] = round((r['EUR/год'] / sumAnnual) * 100) + '%';
});

breakdown.push({
  '№': '',
  'Модуль (лицензия)': 'ИТОГО (прайс-лист API)',
  'CODE': '',
  'EUR/номер/мес': '',
  'BASE EUR/мес': '',
  'MIN EUR/мес': '',
  'USER EUR/ед./мес': '',
  'Кол-во USER': '',
  'Формула (мес.)': '',
  'EUR/мес': round(breakdown.reduce((s, r) => s + (r['EUR/мес'] || 0), 0)),
  'EUR/год': sumAnnual,
  'Install EUR': sumInstall,
  'EUR/год+install': sumAnnual + sumInstall,
  '% от итога': '100%',
  'Обязательный?': '',
  'Комментарий': '',
});

breakdown.push({
  '№': '',
  'Модуль (лицензия)': 'ФАКТ: оплата Nafta (из переписки)',
  'CODE': '',
  'EUR/номер/мес': '',
  'BASE EUR/мес': '',
  'MIN EUR/мес': '',
  'USER EUR/ед./мес': '',
  'Кол-во USER': '',
  'Формула (мес.)': '',
  'EUR/мес': round(HOTEL.actualPaidEur / 12),
  'EUR/год': HOTEL.actualPaidEur,
  'Install EUR': 0,
  'EUR/год+install': HOTEL.actualPaidEur,
  '% от итога': '',
  'Обязательный?': '',
  'Комментарий': `Скидка vs API: ${round(sumAnnual - HOTEL.actualPaidEur)} EUR (${round((1 - HOTEL.actualPaidEur / sumAnnual) * 100)}%)`,
});

function comment(code, c) {
  const m = {
    DMENU: 'Дешёвый legacy-модуль; Smart Menu (DigitalMenu) дороже ~240 EUR/год',
    DoorLockIntegration: 'USEFACTOR=false — пакет не снижает; проверьте, используется ли',
    FixedAsset: 'Часто дублирует STOCK; кандидат на отключение',
    'F&B': 'Нужен только при кухне с рецептурами; дублирует POS+STOCK',
    SPA: 'USERPRICE 4 EUR/терминал/мес — уточнить число касс SPA',
    POS: 'USERPRICE 4 EUR/терминал/мес — уточнить число POS-терминалов',
  };
  return m[code] || '';
}

// --- Optimization scenarios ---
function scenarioTotal(codes, opts = {}) {
  let t = 0;
  codes.forEach((code) => {
    const p = byCode[code];
    if (!p) return;
    const item = ACTIVE.find((a) => a.code === code);
    t += calc(p, {
      packetFactor: opts.packetFactor ?? HOTEL.packetFactor,
      userPriceQty: item?.userPriceQty ?? 1,
    }).annual;
  });
  return round(t);
}

const allCodes = ACTIVE.map((a) => a.code);
const scenarios = [
  {
    'Сценарий': 'Текущий набор модулей (Standart)',
    'Модули': allCodes.join(', '),
    'EUR/год': scenarioTotal(allCodes),
    'Экономия vs текущий API': 0,
    'Экономия vs факт 5000': round(5000 - scenarioTotal(allCodes)),
  },
  {
    'Сценарий': 'Только PMS + Channel (минимум отеля)',
    'Модули': 'PMS, ChannelManager&BookingEngine',
    'EUR/год': scenarioTotal(['PMS', 'ChannelManager&BookingEngine']),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(['PMS', 'ChannelManager&BookingEngine'])),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(['PMS', 'ChannelManager&BookingEngine'])),
  },
  {
    'Сценарий': 'PMS + Channel + ACC + STOCK + POS (без SPA, F&B, Fixed, Door, Menu)',
    'Модули': 'PMS, Channel, ACC, STOCK, POS',
    'EUR/год': scenarioTotal(['PMS', 'ChannelManager&BookingEngine', 'ACC', 'STOCK', 'POS']),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(['PMS', 'ChannelManager&BookingEngine', 'ACC', 'STOCK', 'POS'])),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(['PMS', 'ChannelManager&BookingEngine', 'ACC', 'STOCK', 'POS'])),
  },
  {
    'Сценарий': 'Текущий набор БЕЗ SPA + DMENU',
    'Модули': allCodes.filter((c) => !['SPA', 'DMENU'].includes(c)).join(', '),
    'EUR/год': scenarioTotal(allCodes.filter((c) => !['SPA', 'DMENU'].includes(c))),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(allCodes.filter((c) => !['SPA', 'DMENU'].includes(c)))),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(allCodes.filter((c) => !['SPA', 'DMENU'].includes(c)))),
  },
  {
    'Сценарий': 'Текущий набор БЕЗ FixedAsset + Procurement',
    'Модули': allCodes.filter((c) => !['FixedAsset', 'Procurement'].includes(c)).join(', '),
    'EUR/год': scenarioTotal(allCodes.filter((c) => !['FixedAsset', 'Procurement'].includes(c))),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(allCodes.filter((c) => !['FixedAsset', 'Procurement'].includes(c)))),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(allCodes.filter((c) => !['FixedAsset', 'Procurement'].includes(c)))),
  },
  {
    'Сценарий': 'Текущий набор на пакете MIDI (×0.5 room)',
    'Модули': allCodes.join(', ') + ' [Midi factor 0.5]',
    'EUR/год': scenarioTotal(allCodes, { packetFactor: 0.5 }),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(allCodes, { packetFactor: 0.5 })),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(allCodes, { packetFactor: 0.5 })),
  },
  {
    'Сценарий': 'PMS+Channel на MIDI',
    'Модули': 'PMS, Channel [Midi]',
    'EUR/год': scenarioTotal(['PMS', 'ChannelManager&BookingEngine'], { packetFactor: 0.5 }),
    'Экономия vs текущий API': round(sumAnnual - scenarioTotal(['PMS', 'ChannelManager&BookingEngine'], { packetFactor: 0.5 })),
    'Экономия vs факт 5000': round(5000 - scenarioTotal(['PMS', 'ChannelManager&BookingEngine'], { packetFactor: 0.5 })),
  },
];

// Per-module savings if removed
const removeScenarios = ACTIVE.filter((a) => !a.essential).map((item) => {
  const rest = allCodes.filter((c) => c !== item.code);
  const newTotal = scenarioTotal(rest);
  return {
    'Если отключить': item.label,
    'CODE': item.code,
    'EUR/год без модуля': newTotal,
    'Экономия EUR/год': round(sumAnnual - newTotal),
    '% экономии': round(((sumAnnual - newTotal) / sumAnnual) * 100) + '%',
    'Риск': riskIfRemove(item.code),
  };
});

function riskIfRemove(code) {
  const r = {
    SPA: 'Средний — если SPA реально работает на кассе',
    DMENU: 'Низкий — 37 EUR/год',
    DoorLockIntegration: 'Низкий — если замки не интегрированы',
    FixedAsset: 'Низкий — если учёт ОС в Excel/1C',
    Procurement: 'Низкий — если закупки через STOCK',
    'F&B': 'Средний — если нет расчёта себестоимости блюд',
    POS: 'Высокий — нужен для F&B точек',
    STOCK: 'Высокий — склад ресторана/бара',
    ACC: 'Высокий — бухгалтерия в системе',
  };
  return r[code] || '';
}

const meta = [
  { Параметр: 'Отель', Значение: HOTEL.name },
  { Параметр: 'Номеров', Значение: HOTEL.rooms },
  { Параметр: 'Период', Значение: HOTEL.period },
  { Параметр: 'Пакет', Значение: HOTEL.package },
  { Параметр: 'Формула', Значение: 'annual = 12 × (rooms×ROOMPRICE×packet + BASE + USERPRICE×qty) × period' },
  { Параметр: 'Источник цен', Значение: 'priceapi/getapi.php?type=product (май 2026)' },
];

const docDir = path.join(__dirname, '..', 'doc', 'nafta');
const h1 = Object.keys(breakdown[0]);
const h2 = Object.keys(scenarios[0]);
const h3 = Object.keys(removeScenarios[0]);

fs.writeFileSync(path.join(docDir, 'nafta-license-pricing.csv'), toCsv(breakdown, h1), 'utf8');
fs.writeFileSync(path.join(docDir, 'nafta-license-scenarios.csv'), toCsv(scenarios, h2), 'utf8');
fs.writeFileSync(path.join(docDir, 'nafta-license-remove-module.csv'), toCsv(removeScenarios, h3), 'utf8');
fs.writeFileSync(path.join(docDir, 'nafta-license-meta.csv'), toCsv(meta, ['Параметр', 'Значение']), 'utf8');

// Combined workbook-friendly single file (sections)
const combined = [
  '=== META ===',
  toCsv(meta, ['Параметр', 'Значение']),
  '',
  '=== РАСЧЁТ ПО ПОЗИЦИЯМ (1 ГОД) ===',
  toCsv(breakdown, h1),
  '',
  '=== СЦЕНАРИИ ОПТИМИЗАЦИИ ===',
  toCsv(scenarios, h2),
  '',
  '=== ЭКОНОМИЯ ПРИ ОТКЛЮЧЕНИИ ОДНОГО МОДУЛЯ ===',
  toCsv(removeScenarios, h3),
].join('\r\n');
fs.writeFileSync(path.join(docDir, 'nafta-license-full.xlsx.csv'), combined, 'utf8');

// Native .xlsx (requires: npm install xlsx)
try {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Параметры');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdown), 'Расчёт по позициям');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenarios), 'Сценарии');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(removeScenarios), 'Отключить модуль');
  const xlsxPath = path.join(docDir, 'nafta-license-pricing.xlsx');
  XLSX.writeFile(wb, xlsxPath);
  console.log('Written', xlsxPath);
} catch (e) {
  console.warn('xlsx skipped:', e.message);
}

console.log('Written CSV files to doc/');
console.log('API total:', sumAnnual, 'Actual:', HOTEL.actualPaidEur);
