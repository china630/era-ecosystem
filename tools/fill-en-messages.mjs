#!/usr/bin/env node
/**
 * Fill EN messages: auth from i18n-common, shared chrome from template/retail,
 * domain keys from RU with phrase translation.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const MESSAGE_DIRS = [
  "era-orchestrator/apps/web/messages",
  "era-clinic/messages",
  "era-retail-pos/messages",
  "era-logistics/messages",
  "era-construction/messages",
  "era-crm/messages",
  "era-auto-service/messages",
  "era-wholesale/messages",
  "era-fnb-pos/messages",
  "era-hotel-pms/messages",
];

const commonEn = JSON.parse(
  fs.readFileSync(path.join(root, "packages/i18n-common/messages/common.en.json"), "utf8"),
);
const retailEn = JSON.parse(
  fs.readFileSync(path.join(root, "era-retail-pos/messages/en.json"), "utf8"),
);
const sharedTemplate = JSON.parse(
  fs.readFileSync(path.join(root, "tools/i18n-shared-en-template.json"), "utf8"),
);
const orchEn = JSON.parse(
  fs.readFileSync(path.join(root, "era-orchestrator/apps/web/messages/en.json"), "utf8"),
);
const domainOverrides = JSON.parse(
  fs.readFileSync(path.join(root, "tools/i18n-domain-en-overrides.json"), "utf8"),
);

const PHRASES = [
  ["Спутник клиники и медицинских операций", "Clinic and medical operations satellite"],
  ["Спутник логистики и транспорта", "Logistics and transport satellite"],
  ["Спутник строительства и проектов", "Construction and projects satellite"],
  ["Спутник полевых продаж и CRM", "Field sales and CRM satellite"],
  ["Спутник автосервиса и СТО", "Auto service and STO satellite"],
  ["Спутник оптовых B2B операций", "Wholesale B2B operations satellite"],
  ["Войдите в учётную запись", "Sign in to your account"],
  ["Или войдите через SSO ERA Finance / Orchestrator", "Or SSO via ERA Finance / Orchestrator"],
  ["Отраслевой спутник ERA", "ERA industry satellite"],
  ["Что такое платформа ERA?", "What is the ERA platform?"],
  [
    "В экосистеме ERA идентичность, подписки и отраслевые модули объединены через control plane ERA 365 и Finance ERP.",
    "In the ERA ecosystem, identity, subscriptions, and industry modules are unified through the ERA 365 control plane and Finance ERP.",
  ],
  ["Как войти через SSO?", "How do I sign in with SSO?"],
  [
    "Перейдите в этот модуль из ERA Finance или ERA 365 Orchestrator — токен передаётся автоматически.",
    "Open this module from ERA Finance or ERA 365 Orchestrator — the token is passed automatically.",
  ],
  ["Где зарегистрировать организацию?", "Where do I register an organization?"],
  [
    "После первого входа — «Регистрация организации» в Orchestrator или через app.era-365.online с VÖEN.",
    "After first sign-in use Organization registration in Orchestrator or app.era-365.online with VÖEN.",
  ],
  [
    "Операционная MVP-оболочка — UI по DESIGN.md.",
    "MVP operational shell — UI per DESIGN.md.",
  ],
  [
    "Реестры и формы добавления/редактирования будут в модалках по DESIGN.md.",
    "Registries and create/edit forms will use modals per DESIGN.md.",
  ],
  [
    "Реестры и формы будут в модалках по DESIGN.md.",
    "Registries and forms will use modals per DESIGN.md.",
  ],
  ["Демо: waiter/waiter или manager/manager", "Demo: waiter/waiter or manager/manager"],
  ["Демо: waiter/waiter · admin/admin123", "Demo: waiter/waiter · admin/admin123"],
];

const WORDS = [
  ["Загрузка", "Loading"],
  ["Сохранить", "Save"],
  ["Изменить", "Edit"],
  ["Поле", "Field"],
  ["Значение", "Value"],
  ["Действия", "Actions"],
  ["Завершить", "Complete"],
  ["Все", "All"],
  ["Поиск", "Search"],
  ["Название", "Name"],
  ["Статус", "Status"],
  ["Дата", "Date"],
  ["Гость", "Guest"],
  ["Примечания", "Notes"],
  ["Описание", "Description"],
  ["Создать", "Create"],
  ["Удалить", "Delete"],
  ["Открыть", "Open"],
  ["Назад", "Back"],
  ["Далее", "Next"],
  ["Найти", "Find"],
  ["Применить", "Apply"],
  ["Оплатить", "Pay"],
  ["Ошибка", "Error"],
  ["Не найдено", "Not found"],
  ["Выберите", "Select"],
  ["необязательно", "optional"],
  ["визит", "visit"],
  ["Рейс", "Trip"],
  ["Рейсы", "Trips"],
  ["Проект", "Project"],
  ["Проекты", "Projects"],
  ["Заявки", "Requisitions"],
  ["Лид", "Lead"],
  ["Визит", "Visit"],
  ["Визиты", "Visits"],
  ["Заказы", "Orders"],
  ["Клиент", "Customer"],
  ["Номер", "Number"],
  ["Код", "Code"],
  ["Модуль", "Module"],
  ["Пакет", "Bundle"],
  ["Скидка", "Discount"],
  ["Сохранено", "Saved"],
  ["Загрузка pipeline…", "Loading pipeline…"],
  ["бронирования", "booking"],
  ["создания", "creation"],
  ["подтверждения", "confirmation"],
  ["проверки", "check"],
  ["действия", "action"],
  ["накладной", "waybill"],
  ["отчёта", "report"],
  ["Записи", "Appointments"],
  ["Записаться", "Book appointment"],
  ["Забронировать", "Book"],
  ["Госномер", "License plate"],
  ["Предстоящие", "Upcoming"],
  ["Контрагент", "Counterparty"],
  ["Новый", "New"],
  ["заказ", "work order"],
  ["Заказ", "Work order"],
  ["Работа", "Labor"],
  ["Запчасть", "Part"],
  ["Сервис", "Workshop"],
  ["Склад", "Warehouse"],
  ["рейс", "trip"],
  ["Рейс", "Trip"],
  ["рейсов", "trips"],
  ["Заказано", "Ordered"],
  ["Лимит", "Limit"],
  ["Собрано", "Picked"],
  ["комплектации", "pick lists"],
  ["сборку", "pick"],
  ["кредита", "credit"],
  ["кредит", "credit"],
  ["опта", "wholesale"],
  ["лиды", "leads"],
  ["лид", "lead"],
  ["визит", "visit"],
  ["Визит", "Visit"],
  ["visitы", "visits"],
  ["visitов", "visits"],
  ["Канал", "Channel"],
  ["Превью", "Preview"],
  ["контакт", "contact"],
  ["thread", "thread"],
  ["объект", "site"],
  ["парк", "fleet"],
  ["клинику", "clinic"],
  ["клиники", "clinic"],
  ["практика", "practice"],
  ["практики", "practices"],
  ["расписание", "schedule"],
  ["лаборатор", "lab"],
  ["лаб.", "lab"],
  ["образец", "sample"],
  ["результаты", "results"],
  ["диагноз", "diagnosis"],
  ["диагнозы", "diagnoses"],
  ["Жалобы", "Complaints"],
  ["Проживание", "Stay"],
  ["топлив", "fuel"],
  ["таможн", "customs"],
  ["накладн", "waybill"],
  ["проект", "project"],
  ["проектов", "projects"],
  ["заявк", "requisition"],
  ["дневник", "diary"],
  ["бригады", "crew"],
  ["прогресса", "progress"],
  ["команду", "team"],
  ["сервис", "workshop"],
  ["склад", "warehouse"],
  ["Fieldвые", "Field"],
];

function translateRu(value) {
  if (value == null || typeof value !== "string") return value;
  if (!/[А-Яа-яЁё]/.test(value)) return value;
  if (domainOverrides[value]) return domainOverrides[value];
  let out = value;
  for (const [ru, en] of Object.entries(domainOverrides).sort((a, b) => b[0].length - a[0].length)) {
    if (out.includes(ru)) out = out.split(ru).join(en);
  }
  for (const [ru, en] of PHRASES.sort((a, b) => b[0].length - a[0].length)) {
    if (out === ru) return en;
    out = out.split(ru).join(en);
  }
  for (const [ru, en] of WORDS.sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(ru).join(en);
  }
  return out;
}

function deepKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...deepKeys(v, p));
    else keys.push(p);
  }
  return keys;
}

function getPath(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => o?.[k], obj);
}

function setPath(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepMerge(base, overlay) {
  for (const [k, v] of Object.entries(overlay ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      base[k] ??= {};
      deepMerge(base[k], v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

function pickShared(en, key) {
  return (
    getPath(retailEn, key) ??
    getPath(sharedTemplate, key) ??
    getPath(orchEn, key)
  );
}

function fillDir(dir) {
  const az = JSON.parse(fs.readFileSync(path.join(root, dir, "az.json"), "utf8"));
  const ruPath = path.join(root, dir, "ru.json");
  const ru = fs.existsSync(ruPath)
    ? JSON.parse(fs.readFileSync(ruPath, "utf8"))
    : {};
  const enPath = path.join(root, dir, "en.json");
  let en = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, "utf8")) : {};

  deepMerge(en, sharedTemplate);
  en.auth = { ...en.auth, ...commonEn.auth };

  let changed = 0;
  for (const key of deepKeys(az)) {
    if (key.startsWith("auth.")) continue;
    const shared = pickShared(en, key);
    const ruVal = getPath(ru, key);
    const azVal = getPath(az, key);
    if (typeof azVal !== "string") continue;

    let next = getPath(en, key);
    if (next === undefined || /[А-Яа-яЁё]/.test(String(next))) {
      next =
        (shared && !/[А-Яа-яЁё]/.test(String(shared)) ? shared : undefined) ??
        translateRu(ruVal) ??
        translateRu(azVal);
      if (next !== getPath(en, key)) {
        setPath(en, key, next);
        changed++;
      }
    }
  }

  fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`, "utf8");
  console.log(`${dir}: updated ${changed} keys`);
  return changed;
}

let parityFail = false;
for (const dir of MESSAGE_DIRS) fillDir(dir);

for (const dir of MESSAGE_DIRS) {
  const az = JSON.parse(fs.readFileSync(path.join(root, dir, "az.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(root, dir, "en.json"), "utf8"));
  const missing = deepKeys(az).filter((k) => getPath(en, k) === undefined);
  const cyrillic = deepKeys(en).filter((k) => {
    const v = getPath(en, k);
    return typeof v === "string" && /[А-Яа-яЁё]/.test(v);
  });
  if (missing.length) {
    console.error(`${dir}: missing ${missing.length} keys`);
    parityFail = true;
  }
  if (cyrillic.length) {
    console.warn(`${dir}: ${cyrillic.length} values still contain Cyrillic (domain copy — extend PHRASES in fill-en-messages.mjs)`);
  }
}

if (parityFail) process.exitCode = 1;
else console.log("EN parity OK");
