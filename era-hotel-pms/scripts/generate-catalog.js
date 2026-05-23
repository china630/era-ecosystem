const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'doc', 'elektraweb-modules-catalog.md');
const scrape = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'doc', 'modules-scrape-data.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'doc', 'data', 'price_product.json'), 'utf8')).ResultSets[0];

function decodeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&ccedil;/g, 'ç')
    .replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü').replace(/&Ccedil;/g, 'Ç')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(n) {
  return decodeHtml(n || '')
    .replace(/ElektraWeb |Elektraweb /gi, '')
    .replace(/ Yazılımı/gi, '')
    .trim();
}

// PMS sub-features from marketing (on-buro deep dive)
const PMS_SUBMODULES = [
  { name: 'Günlük Durum Ekranı (Dashboard)', desc: 'Единый дашборд: загрузка, выручка, forecast, проживающие, резервации, заметки call-центра. Графики и списки, автообновление, мобильный доступ.', features: ['KPI отеля в реальном времени', 'Настраиваемый интервал обновления', 'Доступ с любого устройства'] },
  { name: 'Rezervasyon', desc: 'Полный цикл бронирования: списки, карточка, группы, фильтры, Excel.', features: ['Мульти-сортировка, фильтрация, группировка', 'Цветовая индикация статусов', 'Контроль дубликатов гостей (merge профилей)', 'Цифровой архив документов в карточке', 'RBAC на уровне полей и меню', 'Экспорт в Excel/печать'] },
  { name: 'Rezervasyon Kartı', desc: 'Центральная карточка брони со всеми вкладками.', features: ['Быстрый доступ к ценам, агенту, гостю, sales project', 'Блокировка номера одной кнопкой', 'Просмотр доступности по типам номеров', 'Хранение карт гостя, payment link, prepayment'] },
  { name: 'Blokaj (Room Plan)', desc: 'Визуальный план номеров: drag-and-drop.', features: ['Назначение номеров из OTA-резерваций', 'Check-in/out, folio, tahsilat с доски', 'Смена номера/даты перетаскиванием', 'Интеграция channel manager на экране'] },
  { name: 'Roomrack', desc: 'Операционная доска выездов/заездов.', features: ['Фильтр по arrivals/departures/in-house', 'VIP / late C/I / C/O иконки', 'Tahsilat, folio, checkout без смены экрана', 'Цвета по статусу уборки'] },
  { name: 'Kat Hizmetleri (Housekeeping)', desc: 'Цифровое управление уборкой.', features: ['Распределение горничных (равномерная нагрузка)', 'Статусы: temiz / kirli / arızalı', 'Отчёты maid и şef'] },
  { name: 'Folyo', desc: 'Счёт гостя и финансовые операции.', features: ['Мультивалютность с авто-конвертацией', 'Несколько окон одного счёта', 'Posting, payment, invoice с одного экрана', 'Разные форматы печати folio'] },
  { name: 'Ön Muhasebe / Kasa', desc: 'Касса и дебиторка на стойке.', features: ['Cari hesap, çek/senet vade', 'e-Fatura / e-Arşiv', 'Kasa raporu', 'Personel hesap takibi'] },
  { name: 'Forecast ve Analiz', desc: 'Прогноз и аналитика.', features: ['Forecast по любому полю карточки', 'График клик → детальные списки на дату', 'Диапазон дат: occupancy, revenue, movement'] },
  { name: 'Görev Yönetimi', desc: 'Тикеты и SLA между отделами.', features: ['Авто-задачи из запросов/жалоб гостя', 'Эскалация при просрочке', 'Мобильные уведомления исполнителю', 'VIP/setup/prepayment чеклисты'] },
  { name: 'KBS / Kimlik Bildirimi', desc: 'Уведомление полиции (Турция).', features: ['Интеграция с Kimlikokur / mobil okuyucu', 'Соответствие требованиям KBS'] },
];

const INTEGRATION_MODULES = [
  { code: 'VirtualPOSIntegration', group: 'Платежи' },
  { code: 'CashRegisterIntegration', group: 'Платежи' },
  { code: 'DoorLockIntegration', group: 'Доступ' },
  { code: 'TelephoneSwitchboardIntegration', group: 'Коммуникации' },
  { code: 'IPSwitchboard', group: 'Коммуникации' },
  { code: 'WhatsappIntegration', group: 'Коммуникации' },
  { code: 'BookingAPI', group: 'API' },
  { code: 'ReservationAPI', group: 'API' },
  { code: 'CRMAPI', group: 'API' },
  { code: 'ERPAPI', group: 'API' },
  { code: 'TaskManagerAPI', group: 'API' },
  { code: 'CallCenterAPI', group: 'API' },
  { code: 'HotspotApi', group: 'API' },
  { code: 'WebService', group: 'API' },
  { code: 'ChannelManagerIntegration', group: 'Каналы' },
  { code: 'AccountingIntegration', group: 'ERP' },
  { code: 'iP/PayTvIntegration', group: 'In-room' },
  { code: 'HeatingandCoolingIntegration', group: 'In-room' },
  { code: 'FoodCartIntegration', group: 'POS' },
  { code: 'Ktmapi', group: 'Compliance TR' },
];

const QM_SUBMODULES = [
  'Doküman Yönetimi', 'Denetim Yönetimi', 'DOIF Yönetimi', 'İnsan Kaynakları Yönetimi',
  'Strateji ve Süreç Yönetimi', 'Eğitim Yönetimi', 'Ölçme ve Değerlendirme',
  'Proje ve Risk Yönetimi', 'Tedarikçi Yönetimi', 'Mevzuat Yönetimi',
  'Ekipman ve Bakım Yönetimi', 'Performans Değerlendirme', 'Karbon Ayak İzi',
  'Su Ayak İzi', 'GSTC Sertifikasyonu', 'Kampanya Yönetimi',
];

function moduleBlock(m, idx) {
  const api = m.api || {};
  const descEn = decodeHtml(api.DESCRIPTION_EN || api.DESCRIPTION || '');
  let md = `### ${idx}. ${decodeHtml(m.name || m.pageTitle)}\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| **Категория** | ${m.cat} |\n`;
  if (m.code) md += `| **Код (API)** | \`${m.code}\` |\n`;
  if (api.ID) md += `| **Product ID** | ${api.ID} |\n`;
  md += `| **Страница** | [${m.slug || '—'}](${m.url || api.TR_LINK || '—'}) |\n`;
  if (api.EN_LINK) md += `| **Eptera docs** | [EN](${api.EN_LINK}) |\n`;
  md += '\n';

  if (descEn) {
    md += `**Назначение:** ${descEn}\n\n`;
  }

  if (m.sections && m.sections.length) {
    md += `#### Функциональные блоки (с сайта)\n\n`;
    for (const s of m.sections) {
      const t = decodeHtml(s.title);
      if (!t || t === ' ') continue;
      if (s.para) md += `**${t}** — ${decodeHtml(s.para)}\n\n`;
      if (s.bullets && s.bullets.length) {
        s.bullets.forEach(b => { md += `- ${decodeHtml(b)}\n`; });
        md += '\n';
      }
    }
  }

  if (m.localImages && m.localImages.length) {
    md += `#### Скриншоты / визуалы\n\n`;
    m.localImages.forEach((img, i) => {
      md += `![${m.slug}-${i + 1}](${img})\n\n`;
    });
  }

  md += `#### Что клонировать (чеклист для Nafta)\n\n`;
  md += `- [ ] Модель данных и CRUD\n`;
  md += `- [ ] UI-экраны и отчёты\n`;
  md += `- [ ] Интеграции с ядром PMS\n`;
  md += `- [ ] Права доступа (RBAC)\n`;
  md += `- [ ] Мобильная версия (если применимо)\n\n`;
  md += '---\n\n';
  return md;
}

function apiOnlyBlock(p) {
  const name = cleanName(p.NAME);
  const desc = decodeHtml(p.DESCRIPTION_EN || p.DESCRIPTION || '');
  if (!name) return '';
  let md = `### ${name} (\`${p.CODE || p.ID}\`)\n\n`;
  if (desc) md += `${desc}\n\n`;
  if (p.TR_LINK) md += `- Документация/сайт: ${p.TR_LINK}\n`;
  if (p.USERPRICE) md += `- Лицензирование: USERPRICE ${p.USERPRICE} EUR/пользователь/мес\n`;
  if (p.INSTALLATIONFEE) md += `- Разовая установка: ${p.INSTALLATIONFEE} EUR\n`;
  md += '\n';
  return md;
}

let md = '';
md += '# Elektraweb — полный каталог модулей для клонирования (Nafta)\n\n';
md += '> **Цель:** детальные описания всех модулей Elektraweb для разработки собственного PMS/ERP.\n';
md += '> **Контекст:** Nafta уже использует Elektraweb (~5000 EUR/год) и переходит на свой продукт с возможностью перепродажи.\n';
md += '> **Дата:** 20 мая 2026\n\n';
md += '---\n\n';

md += '## Содержание\n\n';
md += '1. [Архитектура платформы](#1-архитектура-платформы)\n';
md += '2. [Otel / PMS — маркетинговые модули](#2-otel--pms--маркетинговые-модули)\n';
md += '3. [PMS Ön Büro — подмодули ядра](#3-pms-ön-büro--подмодули-ядра)\n';
md += '4. [POS](#4-pos)\n';
md += '5. [ERP](#5-erp)\n';
md += '6. [Diğer решения](#6-diğer-решения)\n';
md += '7. [Интеграции и API](#7-интеграции-и-api)\n';
md += '8. [Мобильные приложения](#8-мобильные-приложения)\n';
md += '9. [Kalite Yönetimi (QM) — подмодули](#9-kalite-yönetimi-qm--подмодули)\n';
md += '10. [Служебные SKU и hardware](#10-служебные-sku-и-hardware)\n';
md += '11. [Полный реестр API (174 SKU)](#11-полный-реестр-api-174-sku)\n';
md += '12. [Приоритеты клонирования для Nafta](#12-приоритеты-клонирования-для-nafta)\n\n';
md += 'Скриншоты: папка `doc/screenshots/elektraweb/` (~100+ изображений с маркетинговых страниц).\n\n';
md += '---\n\n';

md += '## 1. Архитектура платформы\n\n';
md += '| Компонент | Описание |\n|-----------|----------|\n';
md += '| **app.elektraweb.com** | Рабочее облачное приложение (PMS) |\n';
md += '| **teklifapp / priceapi** | Конфигуратор лицензий (Angular + REST) |\n';
md += '| **yardim.elektraweb.com** | Документация пользователя |\n';
md += '| **operator.elektraweb.com** | Мобильное приложение Operator |\n';
md += '| **Мультитенантность** | Один инстанс — много отелей (типичная SaaS-модель) |\n';
md += '| **Стек (публично)** | Web-based, cloud, WordPress-маркетинг + отдельное SPA |\n\n';
md += '**Связи модулей:** PMS — центр; POS/Stok/Muhasebe постят в folio; Channel Manager пишет резервации; CRM/Call Center читают профиль гостя; Mobile apps — тонкие клиенты к API.\n\n';
md += '---\n\n';

// Group scrape by cat
const byCat = {};
scrape.forEach(m => {
  if (!byCat[m.cat]) byCat[m.cat] = [];
  byCat[m.cat].push(m);
});

md += '## 2. Otel / PMS — маркетинговые модули\n\n';
let n = 1;
(byCat['Otel / PMS'] || []).forEach(m => { md += moduleBlock(m, n++); });

md += '## 3. PMS Ön Büro — подмодули ядра\n\n';
md += '> Входит в лицензию **PMS** — отдельно не продаётся. Это функциональные экраны внутри Ön Büro.\n\n';

const onBuroPath = path.join(__dirname, '..', 'doc', 'on-buro-features.json');
if (fs.existsSync(onBuroPath)) {
  const onBuro = JSON.parse(fs.readFileSync(onBuroPath, 'utf8'));
  onBuro.forEach((sub, i) => {
    md += `### 3.${i + 1}. ${sub.title}\n\n`;
    sub.bullets.forEach(b => { md += `- ${decodeHtml(b.replace(/\n\t/g, ' '))}\n`; });
    md += '\n';
  });
} else {
  PMS_SUBMODULES.forEach((sub, i) => {
    md += `### 3.${i + 1}. ${sub.name}\n\n${sub.desc}\n\n`;
    sub.features.forEach(f => { md += `- ${f}\n`; });
    md += '\n';
  });
}
md += '**Скриншоты PMS:** `screenshots/elektraweb/on-buro-1.png` … `on-buro-3.webp` + полный набор в `doc/.cache/pages/on-buro.html`\n\n---\n\n';

md += '## 4. POS\n\n';
n = 1;
(byCat['POS'] || []).forEach(m => { md += moduleBlock(m, n++); });

md += '## 5. ERP\n\n';
n = 1;
(byCat['ERP'] || []).forEach(m => { md += moduleBlock(m, n++); });

md += '## 6. Diğer решения\n\n';
n = 1;
(byCat['Diğer'] || []).forEach(m => { md += moduleBlock(m, n++); });

md += '## 7. Интеграции и API\n\n';
md += '> Отдельная политика: [1 EUR/номер/год](https://www.elektraweb.com/en/api-integrations), min 120 EUR/год.\n\n';
const scrapedCodes = new Set(scrape.map(s => s.code).filter(Boolean));
for (const im of INTEGRATION_MODULES) {
  const p = products.find(x => x.CODE === im.code);
  if (p) {
    md += `#### ${im.group}: ${cleanName(p.NAME)}\n\n`;
    md += apiOnlyBlock(p);
  }
}

md += '## 8. Мобильные приложения\n\n';
const mobileCodes = ['ElektraManager(MobileApp)', 'ElektraOperator(MobileApp)', 'GuestMobileApplication(SuperAssistant)',
  'GuestMobileApplication(HotelSpecific)', 'SmartIDReaderStandard', 'SmartIDReaderPro', 'IKPP', 'StockMobileApplication(Barcode)',
  'FixedAsset(Barcode)MobileApplication', 'Fixtures(RFiD)MobileApplication', 'CheckInKiosk', 'OnlineCheckin', 'DYY', 'QRPdksAPP'];
mobileCodes.forEach(code => {
  const p = products.find(x => x.CODE === code);
  if (p) md += apiOnlyBlock(p);
});

md += '## 9. Kalite Yönetimi (QM) — подмодули\n\n';
md += 'Полный пакет **QM** (Kalite ve Doküman Yönetimi) или отдельные подмодули:\n\n';
QM_SUBMODULES.forEach(name => {
  const p = products.find(x => cleanName(x.NAME) === name || x.NAME?.includes(name));
  md += `- **${name}**`;
  if (p) md += ` — ${decodeHtml(p.DESCRIPTION_EN || '').slice(0, 120)}`;
  md += '\n';
});
md += '\n---\n\n';

md += '## 10. Служебные SKU и hardware\n\n';
md += 'Разовые/сервисные позиции (не функциональные модули, но встречаются в контракте):\n\n';
const service = products.filter(p =>
  !p.CODE || p.INSTALLATIONFEE > 0 && !p.DESCRIPTION_EN ||
  ['DataTransfer', '1HourExtraTraining', 'TrainingOnSite', 'KSUY', 'Development', 'Onetimesetupntrain'].includes(p.CODE) ||
  (p.NAME && /Kurulum|Eğitim|Mikrotik|Tarayıcı|Router|Kontör|Yedekleme/i.test(p.NAME))
);
service.slice(0, 40).forEach(p => {
  md += `- ${cleanName(p.NAME)}`;
  if (p.INSTALLATIONFEE) md += ` — install ${p.INSTALLATIONFEE} EUR`;
  md += '\n';
});
md += '\n---\n\n';

md += '## 11. Полный реестр API (174 SKU)\n\n';
md += '| ID | CODE | Название | EN описание |\n|----|------|----------|-------------|\n';
products.filter(p => p.NAME).sort((a, b) => (a.ORDERNO || 999) - (b.ORDERNO || 999)).forEach(p => {
  const desc = decodeHtml(p.DESCRIPTION_EN || p.DESCRIPTION || '').slice(0, 80).replace(/\|/g, '/');
  md += `| ${p.ID} | ${p.CODE || ''} | ${cleanName(p.NAME).slice(0, 45)} | ${desc} |\n`;
});

md += '\n---\n\n';
md += '## 12. Приоритеты клонирования для Nafta\n\n';
md += 'Учитывая текущий контракт ~5000 EUR/год, типичный набор Nafta, вероятно:\n\n';
md += '| Фаза | Модули | Зачем |\n|------|--------|-------|\n';
md += '| **MVP** | PMS (все подмодули §3), Channel+Booking, базовые отчёты | Замена ежедневной работы reception |\n';
md += '| **v1** | POS, Stok, Muhasebe, e-Fatura (если TR) | F&B и закупки |\n';
md += '| **v2** | CRM, Call Center, Guest App, Online Check-in | Продажи и гость |\n';
md += '| **v3** | API marketplace, partner portal | Перепродажа (ваша цель) |\n';
md += '| **Опционально** | Hotspot/KBS/Kimlik — только если рынок Турция | Compliance |\n\n';
md += '**Рекомендация:** проведите workshop с Nafta — выгрузите список активных модулей из их `app.elektraweb.com` (настройки лицензий) и сопоставьте с этим каталогом.\n\n';

fs.writeFileSync(OUT, md, 'utf8');
console.log('Written', OUT, 'lines', md.split('\n').length);
