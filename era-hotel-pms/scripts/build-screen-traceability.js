/**
 * WA screens → clone-spec traceability
 * Run: node scripts/build-screen-traceability.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'doc', 'nafta', 'screens-manifest.csv');
const SPEC_DIR = path.join(ROOT, 'doc', 'clone-spec');
const OUT_CSV = path.join(ROOT, 'doc', 'nafta', 'screens-traceability.csv');
const OUT_MD = path.join(ROOT, 'doc', 'clone-spec', '11-screen-traceability.md');

function escCsv(v) {
  const s = String(v ?? '');
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsvSemicolon(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const cols = line.split(';');
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? '';
    });
    return o;
  });
}

/** Expand WA0131, WA0058–0059, WA0083–0091 */
function extractWaFromSpec() {
  const overrides = new Map();
  const files = fs.readdirSync(SPEC_DIR).filter((f) => /^0[4-9]|^10-/.test(f) && f.endsWith('.md'));
  const waRe = /WA(\d{4})(?:\s*[–-]\s*WA(\d{4}))?/gi;

  for (const file of files) {
    const doc = file.replace('.md', '');
    const text = fs.readFileSync(path.join(SPEC_DIR, file), 'utf8');
    let section = '';
    for (const line of text.split(/\r?\n/)) {
      const hm = line.match(/^##\s+([\dA-Z.]+\s*[^\n#]+)/);
      if (hm) section = hm[1].trim().slice(0, 40);
      let m;
      waRe.lastIndex = 0;
      while ((m = waRe.exec(line)) !== null) {
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : start;
        for (let n = Math.min(start, end); n <= Math.max(start, end); n++) {
          if (!overrides.has(n) || overrides.get(n).source === 'range') {
            overrides.set(n, { spec_doc: doc, spec_section: section, source: 'spec-ref' });
          }
        }
      }
    }
  }
  return overrides;
}

function ruleMap(row) {
  const menu = `${row.menu_path_ru} ${row.screen_name} ${row.notes}`.toLowerCase();
  const mc = row.module_code;
  const lm = row.license_module;

  if (row.is_empty === 'true') {
    return {
      spec_doc: '—',
      spec_section: 'menu-only',
      phase: '—',
      trace_note: 'Пустой пункт меню; не дублировать в ТЗ',
    };
  }

  if (mc === 'REPORTS') {
    return { spec_doc: '07-night-audit-and-reports', spec_section: 'B', phase: '1', trace_note: 'Отчёты менеджера' };
  }
  if (mc === 'PMS') {
    if (/room plan|шахмат/i.test(menu)) {
      return { spec_doc: '04-pms-core', spec_section: '4.5', phase: '1', trace_note: '' };
    }
    if (/конец дня|night|операц.*конец/i.test(menu)) {
      return { spec_doc: '07-night-audit-and-reports', spec_section: 'A', phase: '1', trace_note: '' };
    }
    return { spec_doc: '04-pms-core', spec_section: '—', phase: '1', trace_note: '' };
  }
  if (mc === 'CASH') {
    return { spec_doc: '05-folio-and-cash', spec_section: '—', phase: '1', trace_note: '' };
  }
  if (mc === 'HK') {
    return { spec_doc: '10-housekeeping', spec_section: '—', phase: '1', trace_note: '' };
  }
  if (mc === 'MED') {
    return { spec_doc: '06-channel-crm-med', spec_section: 'C', phase: '1', trace_note: 'Санаторий' };
  }
  if (mc === 'CRM') {
    if (/канал|channel|ota|extranet/i.test(menu)) {
      return { spec_doc: '06-channel-crm-med', spec_section: 'A', phase: '1', trace_note: '' };
    }
    return { spec_doc: '06-channel-crm-med', spec_section: 'B', phase: '1', trace_note: '' };
  }
  if (mc === 'POS') {
    return { spec_doc: '15-pos-fb-spa', spec_section: '—', phase: '2', trace_note: '' };
  }
  if (mc === 'STOCK') {
    return { spec_doc: '16-stock-procurement', spec_section: '—', phase: '2', trace_note: '' };
  }
  if (mc === 'MAINTENANCE') {
    return { spec_doc: '10-housekeeping', spec_section: 'OOO', phase: '1', trace_note: 'Техобслуживание ≈ OOO' };
  }
  if (mc === 'ACC') {
    if (/проводк|journal|fiş|план счет|оборотно|gl\b|хозрасч|aging|баланс/i.test(menu)) {
      return {
        spec_doc: '01-finance-boundary',
        spec_section: 'out-of-scope',
        phase: 'ERP',
        trace_note: 'GL не в PMS',
      };
    }
    if (/sage|bavel|экспорт|export|e-invoice|e-fatura|fatura|интеграц|банк|banka/i.test(menu)) {
      return { spec_doc: '18-erp-integration', spec_section: '—', phase: '2', trace_note: 'Шлюз ERP/fiscal' };
    }
    if (/код.*доход|revenue|отдел|department|ндс|vat/i.test(menu)) {
      return { spec_doc: '09-master-data', spec_section: '9.4', phase: '1', trace_note: 'Операционный маппинг' };
    }
    if (/импорт|import|продукт|рецепт|stock|закуп|procurement/i.test(menu)) {
      return { spec_doc: '—', spec_section: 'out-of-scope', phase: '2', trace_note: 'Импорт номенклатуры' };
    }
    return { spec_doc: '01-finance-boundary', spec_section: 'ACC-settings', phase: '1', trace_note: 'Настройки ACC без GL' };
  }
  if (mc === 'SETTINGS') {
    if (/лиценз|модул/i.test(menu)) {
      return { spec_doc: '03-phase1-modules', spec_section: '—', phase: 'meta', trace_note: 'Лицензия Elektraweb' };
    }
    if (/канал|ota|booking|elektrasync|channel manager/i.test(menu)) {
      return { spec_doc: '06-channel-crm-med', spec_section: 'A-setup', phase: '1', trace_note: '' };
    }
    if (/crm|гост|задач|task|анкет|whatsapp|vip/i.test(menu)) {
      return { spec_doc: '06-channel-crm-med', spec_section: 'B-setup', phase: '1', trace_note: '' };
    }
    if (/мед|лаборатор|health|sanator/i.test(menu)) {
      return { spec_doc: '06-channel-crm-med', spec_section: 'C-setup', phase: '1', trace_note: '' };
    }
    if (/уборк|housekeeping|hk\b|горнич/i.test(menu)) {
      return { spec_doc: '10-housekeeping', spec_section: 'setup', phase: '1', trace_note: '' };
    }
    if (/касс|folio|платеж|payment|счет|invoice|валют|курс/i.test(menu)) {
      return { spec_doc: '05-folio-and-cash', spec_section: 'setup', phase: '1', trace_note: '' };
    }
    if (/конец дня|night audit|ночн/i.test(menu)) {
      return { spec_doc: '07-night-audit-and-reports', spec_section: 'A-setup', phase: '1', trace_note: '' };
    }
    if (/бухгалтер|acc|muhasebe|sage|ндс|банк/i.test(menu)) {
      return { spec_doc: '01-finance-boundary', spec_section: '—', phase: '1', trace_note: '' };
    }
    if (/пользовател|рол|прав|2fa|парол/i.test(menu)) {
      return { spec_doc: '09-master-data', spec_section: '9.6', phase: '1', trace_note: '' };
    }
    if (/тип ном|номер|питан|тариф|отель|hotel|logo/i.test(menu)) {
      return { spec_doc: '09-master-data', spec_section: '9.1–9.3', phase: '1', trace_note: '' };
    }
    if (/код.*доход|отдел|revenue/i.test(menu)) {
      return { spec_doc: '09-master-data', spec_section: '9.4', phase: '1', trace_note: '' };
    }
    if (/бронир|reservation|check|полиц|kbs/i.test(menu)) {
      return { spec_doc: '04-pms-core', spec_section: 'policies', phase: '1', trace_note: '' };
    }
    if (/pos|spa|stock|закуп|dmenu|замок|door/i.test(menu)) {
      return { spec_doc: '03-phase1-modules', spec_section: 'out', phase: '2/off', trace_note: 'Модуль вне фазы 1' };
    }
    return { spec_doc: '09-master-data', spec_section: '—', phase: '1', trace_note: 'SETTINGS по умолчанию' };
  }

  return { spec_doc: '00-vision-and-boundaries', spec_section: '—', phase: '?', trace_note: 'Требует ручной разметки' };
}

function buildSummary(rows) {
  const byDoc = {};
  const byPhase = {};
  let empty = 0;
  let functional = 0;
  for (const r of rows) {
    if (r.is_empty === 'true') empty++;
    else functional++;
    const d = r.spec_doc || '—';
    byDoc[d] = (byDoc[d] || 0) + 1;
    const p = r.phase || '?';
    byPhase[p] = (byPhase[p] || 0) + 1;
  }
  return { byDoc, byPhase, empty, functional, total: rows.length };
}

function main() {
  const manifest = parseCsvSemicolon(fs.readFileSync(MANIFEST, 'utf8'));
  const overrides = extractWaFromSpec();

  const outRows = manifest.map((row) => {
    const wa = parseInt(row.wa_num, 10);
    const rule = ruleMap(row);
    const ov = overrides.get(wa);
    const mapped =
      ov && row.is_empty !== 'true'
        ? {
            spec_doc: ov.spec_doc,
            spec_section: ov.spec_section || rule.spec_section,
            phase: rule.phase === 'ERP' || rule.phase === '2' ? rule.phase : rule.phase,
            trace_note: rule.trace_note || 'Уточнено по ссылке в spec',
          }
        : rule;

    return {
      ...row,
      spec_doc: mapped.spec_doc,
      spec_section: mapped.spec_section,
      phase: mapped.phase,
      trace_note: mapped.trace_note,
      trace_source: ov && row.is_empty !== 'true' ? 'spec+rules' : 'rules',
    };
  });

  const extraHeaders = ['spec_doc', 'spec_section', 'phase', 'trace_note', 'trace_source'];
  const headers = Object.keys(outRows[0]).filter((h) => !extraHeaders.includes(h));
  const allHeaders = [...headers, ...extraHeaders];

  const csv = [allHeaders.join(';'), ...outRows.map((r) => allHeaders.map((h) => escCsv(r[h])).join(';'))].join('\n');
  fs.writeFileSync(OUT_CSV, csv + '\n', 'utf8');

  const s = buildSummary(outRows);
  const docRows = Object.entries(s.byDoc)
    .filter(([d]) => d !== '—')
    .sort((a, b) => b[1] - a[1]);
  const phaseRows = Object.entries(s.byPhase).sort((a, b) => b[1] - a[1]);
  const phase1Func = outRows.filter((r) => r.is_empty !== 'true' && r.phase === '1').length;
  const outScope = outRows.filter((r) => r.is_empty !== 'true' && (r.phase === '2' || r.phase === 'ERP')).length;

  const unmapped = outRows.filter(
    (r) => r.is_empty !== 'true' && (r.spec_doc === '00-vision-and-boundaries' || r.phase === '?')
  );

  const md = `# 11. Трассировка экранов WA → спецификация

> Автогенерация: \`npm run trace:screens\`  
> Полная таблица (292 строки): [../nafta/screens-traceability.csv](../nafta/screens-traceability.csv)

## Назначение

Связь каждого скриншота Elektraweb (WA0056–WA0347) с разделом функциональной спецификации (ф.1 + ф.2). Используйте для:

- проверки покрытия ТЗ;
- приоритизации разработки UI;
- ответа «где в спеке этот экран?».

## Сводка

| Показатель | Значение |
|------------|----------|
| Всего экранов | ${s.total} |
| Рабочих (не empty) | ${s.functional} |
| Фаза 1 (рабочие) | ${phase1Func} |
| Вне фазы 1 / ERP (рабочие) | ${outScope} |
| Пустых (menu-only) | ${s.empty} |

### По документу спеки

| spec_doc | Экранов |
|----------|---------|
${docRows.map(([d, n]) => `| ${d} | ${n} |`).join('\n')}

### По фазе

| phase | Экранов |
|-------|---------|
${phaseRows.map(([p, n]) => `| ${p} | ${n} |`).join('\n')}

## Как читать CSV

| Колонка | Смысл |
|---------|--------|
| \`wa_num\` | Номер WA (0056 = WA0056) |
| \`spec_doc\` | Файл в \`clone-spec/\` без расширения |
| \`spec_section\` | Раздел внутри документа (или \`menu-only\`, \`out-of-scope\`) |
| \`phase\` | \`1\` фаза 1 · \`2\` позже · \`ERP\` только внешний учёт · \`meta\` лицензия |
| \`trace_source\` | \`spec+rules\` если WA упомянут в углублённой спеке |

## Примеры быстрого поиска

| Вопрос | Где смотреть |
|--------|--------------|
| Room Plan | \`04-pms-core\` · WA0209 |
| Night audit wizard | \`07-night-audit-and-reports\` · WA0131 |
| Коды дохода | \`09-master-data\` §9.4 · WA0066 |
| OTA extranet | \`06-channel-crm-med\` §A · WA0127 |
| Folio | \`05-folio-and-cash\` · WA0136 |

## Требуют ручной проверки

${unmapped.length ? unmapped.slice(0, 15).map((r) => `- WA${String(r.wa_num).padStart(4, '0')}: ${r.screen_name} (${r.module_code})`).join('\n') : '_Нет — все рабочие экраны размечены правилами._'}

${unmapped.length > 15 ? `\n_…и ещё ${unmapped.length - 15} (см. CSV, phase=?)._` : ''}

## Связанные документы

- [12-user-stories-index.md](12-user-stories-index.md) — реестр user stories  
- [13-nafta-validation-checklist.md](13-nafta-validation-checklist.md) — вопросы к отелю
`;

  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log('Wrote', OUT_CSV);
  console.log('Wrote', OUT_MD);
  console.log('Functional:', s.functional, 'Empty:', s.empty);
}

main();
