# Задание для Cursor: живая схема архитектуры ERA 365 на главной и связанных страницах

Работай по этому тексту целиком. Репозиторий: `D:\My Projects\era-ecosystem`. Публичный сайт: `era-orchestrator/apps/web`. Коммиты и деплой делает владелец — сам не коммить и не запускай «ship + push». На ПК владельца сервисы и npm не поднимать в этом задании; правки — в коде.

## 0. Порядок относительно другого промта

Сначала выполни `docs/era-site-menu-design-fix-prompt.md` (шапка, мега-меню, футер, уборка «пенала» и чужих indigo-стилей). **Потом** это задание: новая главная со схемой. Не возвращай в шапку четыре CTA и не вводи indigo/pulse/scale, которые тот промт запретил. Схема должна жить в уже наведённом стиле ERA, а не конкурировать с сломанным меню.

Если шапка ещё не починена — всё равно проектируй схему как отдельный компонент, но в мерже/приёмке главная идёт второй очередью.

---

## 1. Концепция

Рабочий кабинет ERA остаётся строгим. Публичный сайт может быть живее, но сдержанно: не «космос в 3D» и не сетка одинаковых панелей.

Центральный визуал главной — интерактивная схема headless-архитектуры в SVG. Два ядра: **ERA Core** (финансовое, `finance_core`) и **Bank CBS** (банковское, `industry_banking`, бейдж Pilot). Вокруг — сателлиты (продукты) и **только реально найденные в коде связи**. По линиям идут спокойные импульсы «данных». На схеме сразу видно, что это за продукт, чем он занимается и сколько стоит база («от N AZN»). Наведение подсвечивает связи и открывает карточку; клик ведёт на `/{locale}/satellites/{publicSlug}`. Фильтр по отрасли подсвечивает набор сателлитов из каталога. Тот же компонент схемы переиспользуется на странице отрасли (подсветка бандла) и на странице сателлита (его узел и рёбра).

На мобильных схему не пытаемся уместить один в один: упрощённый статичный вид или аккуратный список ядер и продуктов, без анимации импульсов.

Это не лишнее, если сделать как у сдержанных платформенных героев (Stripe, Linear): мало цвета, много воздуха, движение только как намёк на обмен, не как карнавал.

---

## 2. Что взять из референсов и какой подход выбрать

Коротко по эталонам (визуальный язык, не копировать сетку и цвета):

- Stripe, Linear — спокойная 2D-схема или «созвездие»: ясные узлы, тонкие связи, воздух, типографика важнее эффектов.
- Vercel / Supabase — архитектура как карта продукта, интерактив по наведению, первый кадр читается и без анимации.
- Mews — живой герой, но не граф; у нас герой = схема, остальная страница в том же ритме, что в промте шапки.
- Odoo — сетка приложений. Именно этого нельзя: сейчас главная уже «как в пенале».
- Чисто орбитальные 3D-глобусы и particle-canvas — не наш стиль и вредят LCP.

**Выбор для ERA:** плоская SVG-«созвездая» карта (constellation / architecture map) в цветах сайта. Два более крупных ядра, сателлиты — узлы меньшего размера, кластеры по реальным рёбрам (гостиничный мост Hotel–F&B–Clinic–Retail ближе друг к другу; опт рядом с розницей). Не крутить планеты по орбитам и не делать полный mesh «каждый с каждым». Движение — короткие импульсы вдоль уже нарисованных линий (`stroke-dashoffset` / SMIL / framer-motion по path), 1–2 одновременно, низкая непрозрачность.

Токены не менять: `#34495E`, `#2980B9`, `#2471A3`, `#7F8C8D`, `#EBEDF0`, `#D5DADF`, `#EBF5FB`, белый; кнопки `rounded-lg`, карточки `rounded-2xl`; шрифты проекта. Бейдж Pilot — существующий. Без indigo, розового Mews, `slate-950`, glow, scale.

---

## 3. Реальные данные (проверено в коде 27.11.2026). Придуманных связей не добавлять

Источник узлов и публичных имён — каталог сайта (`GET /v1/public/site-catalog`, типы `lib/site/site-catalog-types.ts`, сид `era-orchestrator/packages/database/prisma/lib/core/site-catalog-seed.ts`). Цены — живой `GET /v1/public/pricing` (`foundationMonthlyAzn`, `pricingModules[].key/pricePerMonth`). Ниже — стартовые значения из сида и дефолтов, на витрине всегда приоритет у API.

### 3.1 Узлы (сателлиты / продукты)

| publicSlug | satellite.key | Роль на схеме | Статус | Цена «от» (сид / дефолт) |
|---|---|---|---|---|
| `finance` | `finance_core` | Ядро учёта | prod | Foundation: дефолт **29 AZN/мес** (`SystemConfigService.getFoundationMonthlyAzn`, ключ `billing.foundation_monthly_azn`) |
| `banking` | `industry_banking` | Ядро банка | **Pilot** | Gate **99 AZN/мес** (`pricing-module-seed.ts`, `INDUSTRY_SATELLITE_SEED`). Отдельный ключ `billing.banking_foundation_monthly_azn` есть, дефолт в коде 0 — для витрины ядра бери 99 из модуля, пока foundation банка не задан |
| `hotel` | `industry_hotel_pms` | сателлит | prod | 29 |
| `fnb` | `industry_fnb_pos` | сателлит | prod | 29 |
| `auto` | `industry_auto_service` | сателлит | prod | 29 |
| `logistics` | `industry_logistics` | сателлит | prod | 29 |
| `wholesale` | `industry_wholesale` | сателлит | prod | 29 |
| `crm` | `industry_crm` | сателлит | prod | 29 |
| `workforce` | `platform_workforce` | платформенный | prod | не фикс. месячная; Essential **2 AZN / чел.** (`platform_workforce_base`). На схеме: «от 2 AZN / чел.» |
| `clinic` | `industry_clinic` | сателлит | Pilot | 29 |
| `retail` | `industry_retail` | сателлит | Pilot | 29 |
| `construction` | `industry_construction` | сателлит | Pilot | 29 |
| `data-hub` | `platform_datahub` | платформенный | Pilot | Bronze **29** (`platform_reference_data`); Silver 39, Gold 99 |

Отраслевые гейты 29 и банк 99: `packages/database/prisma/lib/core/pricing-module-seed.ts` (`INDUSTRY_SATELLITE_SEED`). Модули 19/39/99 — add-on ядра и Data HUB, на схеме узла показывай цену базы/гейта, детали модулей — в карточке и на странице продукта.

Подпись узла — `name` из каталога (ERA Core, Hotel PMS, F&B POS, Auto Service, CRM, Bank CBS, Workforce, Data HUB…). Не «Auto STO», не «CRM Field», не «peyk / спутник».

### 3.2 Связи, которые есть в коде (только их)

Рёбра для сида и для схемы. Направление — как в коде. На схеме допустима визуально мягкая линия без стрелки, но в данных храни направление и `kind`.

**A. Выручка / события в финансовое ядро (`REVENUE_EVENT`)**  
`era-orchestrator/apps/api/src/channels/satellite-channels.service.ts` (желаемые рёбра): если у организации есть `finance_core`, для **каждого другого** подключенного сателлита создаётся канал `SatelliteChannelKind.REVENUE_EVENT` → `finance_core` (`CHANNEL_FINANCE_KEY`). Виды каналов: `packages/database/prisma/schema.prisma`, enum `SatelliteChannelKind`.

Коммерческие события, которые сателлиты публикуют в шину (`packages/era-contracts/src/events/`):  
`SATELLITE_HOTEL_INVOICE_ISSUED`, `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`, `SATELLITE_FB_SALE_COMPLETED`, `SATELLITE_RETAIL_SALE_COMPLETED`, `SATELLITE_CLINIC_VISIT_COMPLETED`, `SATELLITE_AUTO_WORK_ORDER_COMPLETED`, `SATELLITE_LOGISTICS_TRIP_COMPLETED`, `SATELLITE_WHOLESALE_ORDER_CONFIRMED`, `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED`, `SATELLITE_CRM_LEAD_CONVERTED`, `SATELLITE_BANK_GL_DAILY_SUMMARY` / `SATELLITE_BANK_PAYMENT_POSTED`, плюс `INVOICE_GL_POSTED` в учёте.

На маркетинговой схеме рисуй `REVENUE_EVENT` к ERA Core для отраслевых сателлитов (hotel, fnb, retail, clinic, auto, logistics, wholesale, construction, crm) и для Bank CBS — тонким ребром с подписью вроде «проводки / выручка в учёт, если оба подключены». Workforce и Data HUB **не** рисуй как выручку в ядро: формально цикл в `desiredEdges` перебирает любые keys кроме finance, но у Workforce нет sale-события, у Data HUB — продуктового канала выручки в коде не найдено. Не добавляй их в revenue-список «на всякий случай».

**B. Folio и расчёты в отель**  
`apps/api/src/channels/satellite-channels.constants.ts`: `CHANNEL_HOTEL_BRIDGE_FROM = industry_clinic, industry_fnb_pos, industry_retail` → `industry_hotel_pms`, виды `FOLIO_POST` и `SETTLEMENT` (тот же `satellite-channels.service.ts`).  
Это подтверждённые связи **F&B → Hotel**, **Clinic → Hotel**, **Retail → Hotel**.

**C. Жизненный цикл гостя: Hotel → Clinic**  
`apps/api/src/satellite-events/clinic-lifecycle-event.ts`: комментарий «Hotel → clinic lifecycle events that orchestrator fans out to clinic hotel-lifecycle». События: check-in/out, departed, moved, room changed, `SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED`, stay product changed. Доставка: `satellite-events.service.ts` (`maybeEnqueueClinicFanout`) → `clinic-bridge.client.ts` `POST {clinic}/api/integration/hotel-lifecycle`.  
Это связь **Hotel → Clinic** (санаторий и совместное проживание), отдельно от folio Clinic → Hotel.

**D. Операционная передача опт → розница**  
Там же constants: «Explicit OPS_HANDOFF PLATFORM pairs (not full mesh)»: только пара `industry_wholesale` → `industry_retail`, вид `OPS_HANDOFF`. **Не** размножай handoff на логистику, автосервис и т. д.

**E. Штат: Workforce / HR → часть сателлитов**  
`STAFF_PROVISIONED` / `STAFF_DEACTIVATED` (`packages/era-contracts/src/events/hr.events.ts`). Оркестратор (`maybeEnqueueStaffFanout`) шлёт на `/{satellite}/api/integration/staff-provision` для `payload.satelliteKey`, если есть entitlement и endpoint. Каталог ролей и env fan-out подтверждены только для: `industry_hotel_pms`, `industry_fnb_pos`, `industry_retail`, `industry_clinic`, `industry_construction` (`packages/era-contracts/src/workforce/satellite-roles.ts`, `FANOUT_URL_ENV` в `satellite-endpoint-registry.service.ts`).  
Рисуй Workforce → эти пять. **Не** пиши «Workforce ↔ все».

### 3.3 Чего в коде нет — не выдумывать

- CRM не связан каналом «со всеми». Есть события лида/визита/звонка и общий `REVENUE_EVENT` в финансы, если CRM и Core подключены. Не делай звезду CRM–каждый сателлит.
- Data HUB: в `CHANNEL_*` и fan-out рёбер к другим сателлитам не найдено. Узел на схеме есть (платформенный, Pilot), **без вымышленных спиц**.
- Logistics ↔ Wholesale, Auto ↔ Retail, Construction ↔ Logistics — в каналах и fan-out не найдены (в отраслевых бандлах часть таких соседств была допущением ⚑). На схему их не ставить.
- Bank CBS не является «вторым солнцем», вокруг которого уже крутятся отель и клиника. Это второе ядро со своими модулями (в т.ч. ДБО, кредиты — на странице банка). Связь с ERA Core — только общее правило `REVENUE_EVENT` / банковские GL-события, если оба продукта у организации есть.
- Не добавляй «интеграцию», которой нет в `OrganizationSatelliteChannel`, `CHANNEL_*` или в `satellite-events` / `era-contracts`.

---

## 4. Данные для схемы: каталог + таблица рёбер

Узлы, тексты, модули, статусы, отраслевые наборы — из существующего публичного каталога. **Не** хардкодь список продуктов в компоненте схемы.

Связей в `site-catalog` сейчас нет. Добавь явную модель, которую можно редактировать и сидить.

Предлагаемая таблица `SiteArchitectureEdge` (имя можно уточнить):

- `id`
- `fromSatelliteKey` (FK на `satellites.key`)
- `toSatelliteKey` (FK)
- `kind`: `REVENUE_EVENT` | `FOLIO_POST` | `SETTLEMENT` | `LIFECYCLE` | `OPS_HANDOFF` | `STAFF_PROVISION` (или строка + проверка по enum)
- `labels` JSON `{ az, ru, en }` — короткая подпись ребра для карточки («Продажа в учёт», «Постование в фолио», «Заезд гостя в клинику», …)
- `enabled` / `visibility` — черновики наружу не попадают
- уникальность `(from, to, kind)`

Сид идемпотентный из таблицы §3.2. Правило «новый отраслевой сателлит»: при появлении новой строки в `satellites` с `kind=industry` сид/сервис **может** автоматически добавить ребро `REVENUE_EVENT` → `finance_core`, если такого ещё нет (это соответствует `desiredEdges` в channels). Никаких авто-рёбер в CRM, Data HUB или «ко всем». Folio, lifecycle, handoff, staff — только явно в сиде или в админке.

Расширь `GET /v1/public/site-catalog` (или вложи в тот же payload) массив `edges: { from, to, kind, label }[]` только с видимыми ключами. Цены схема берет с `/v1/public/pricing` на сервере и отдаёт в узел уже как `fromPriceAzn` + `fromPriceUnit` (`month` | `person`). Кэш тот же, что у каталога (`revalidateTag` / `site.catalog_cache_version`): новый видимый сателлит появляется на схеме без пересборки фронта.

Админка: простой список рёбер рядом с редактором каталога, не обязателен в первом проходе, если сид полный; тогда хотя бы не затирай ручные строки сидом.

---

## 5. Порядок секций главной

Не складывай снова стопку одинаковых карточек «как в пенале». Ритм:

1. **Hero со схемой.** Короткий H1 и подзаголовок (az/ru/en, без слова peyk/спутник): смысл в духе «Учёт и отраслевые продукты — одна платформа» / «Two cores, connected products». Слева или сверху текст + две кнопки по правилам шапки (пробный период primary, калькулятор secondary, демо — текстовая ссылка). Основное поле — схема на всю ширину контейнера `max-w-6xl`. Под схемой или над ней — компактный фильтр отраслей («Показать отрасль»: Все / Отели / Санатории / …). Схема — LCP-элемент: SVG должен быть в серверном HTML.
2. **Отрасли** — уже не главная гора панелей, а короткий ряд/сетка 12 отраслей, клик ведёт на `/{locale}/industries/{slug}` и может применять тот же фильтр. Без дубля огромных карточек, которые повторяют схему.
3. **Цена и калькулятор** — foundation «от 29 AZN», отраслевые «от 29», банк «от 99», CTA «Открыть калькулятор» и «Смотреть тарифы». Без третьего тёмного индиго-баннера.
4. **Доверие** — только если флаг в настройках включён и есть реальные данные. Иначе секции нет.
5. **FAQ (коротко) + нижний CTA** — пробный период + демо/калькулятор, без навала трёх равнозначных кнопок.

Zero-Knowledge / конфиденциальность можно оставить одной спокойной секцией под ценой, без «стеклянной» тёмной плашки.

---

## 6. Техника схемы

- Компонент, например `components/site/architecture-map/ArchitectureMap.tsx`.
- **SVG + React.** Анимация: CSS или `framer-motion`, если он уже в проекте или легко добавляется; не тяни Three.js, react-three-fiber, Pixi, тяжёлый canvas, целый d3-force на главную, если можно обойтись заранее заданным layout + лёгким позиционированием.
- Layout узлов зафиксируй в данных (координаты в viewBox, проценты или слои: ядра, гостиничный кластер, торговый, прочие, платформа). Не пересчитывай физику на каждом кадре. Новый узел без координат — клади в нейтральный слот «прочие» по кругу вокруг ERA Core, чтобы он всё равно появился.
- **SSR:** первый кадр — статический SVG (ядра, линии, подписи, цены), без ожидания JS. Импульсы и карточка наведения — после гидрации.
- **Производительность / LCP < 2.5 с:** никакого видео, никаких тяжёлых текстур; ограничь число одновременных импульсов (например, не больше двух путей); `will-change` не размазывать на всю страницу; `prefers-reduced-motion: reduce` — без импульсов и автосмены, только статичная схема и карточка по фокусу/клику.
- Наведение: подсветка узла и инцидентных рёбер (остальные приглушить), рядом карточка: имя, Pilot, однострочное «что делает» (`tagline` / `description`), цена «от», 2–4 модуля из каталога, ссылка «Подробнее». Клик по узлу или Enter — переход на `/{locale}/satellites/{publicSlug}` (в URL по-прежнему publicSlug; коммерческий ключ в данных).
- Фильтр отрасли: dim узлов вне бандла (`SiteIndustry.items`), бандл и связи внутри него — ярче. «Все» возвращает полный вид. Банковская отрасль подсвечивает Bank CBS, Workforce, ERA Core, CRM, Data HUB — **только если они есть в бандле каталога**, без дорисовки.
- Клавиатура: Tab по узлам, Enter/Space — переход или раскрытие карточки, Escape закрывает карточку, стрелки — соседний узел. У каждого узла `role="link"` или кнопка + доступное имя. Скрытый блок или `aria-describedby` со списком продуктов и связей для скринридера (не полагаться только на SVG).
- Тексты интерфейса схемы (фильтр, «от … / мес», «от … / чел.», виды связей, «Все отрасли») — az/ru/en в next-intl `site` или в профилях рёбер. Глоссарий как в промте шапки.
- Мобильная ширина < 1024: либо упрощённый SVG без импульсов и без мелких подписей на линиях, либо список: два ядра, затем продукты с ценой и статусом, тап открывает карточку/страницу. Не заставляй pinch-zoom микросхему.

Переиспользование:

```ts
<ArchitectureMap
  catalog={catalog}
  pricing={pricing}
  locale={locale}
  variant="home" | "industry" | "product"
  highlightKeys?: string[]      // отрасль: ключи бандла; продукт: [this] + соседи
  emphasizedEdgeKinds?: string[]
/>
```

На `/{locale}/industries/[slug]` схема выше или рядом с составом бандла, с предвыбранным фильтром. На `/{locale}/satellites/[slug]` — компактный вид: этот узел, его рёбра, ядра, без полной россыпи, если тесно; ссылки на соседей.

---

## 7. Критерии приёмки

- Главная начинается с hero-схемы в серверном HTML, не с «пенала» одинаковых панелей. LCP-кандидат — SVG/H1, цель LCP < 2.5 с на обычном канале.
- На схеме два ядра (ERA Core, Bank CBS + Pilot) и все видимые сателлиты из каталога. Новый видимый ключ в БД появляется без пересборки (после revalidate).
- Все нарисованные рёбра соответствуют §3.2 (или более новому сиду, но не вымыслу). Нет звезды «CRM со всеми», нет Workforce со всеми, нет Data HUB-спиц «на будущее».
- Цены «от» совпадают с `/v1/public/pricing` (foundation / гейт 29, банк 99, Data HUB 29, Workforce «от 2 AZN / чел.»).
- Hover/focus подсвечивает связи и карточку; клик ведёт на страницу сателлита; фильтр отрасли подсвечивает бандл.
- `prefers-reduced-motion` отключает импульсы. На 375 px — упрощённый вид или список, схема не обрезана нечитаемо.
- Клавиатура и скринридер: узлы доступны, есть текстовая альтернатива.
- Тексты az/ru/en, без peyk/спутник в UI.
- Цвета и радиусы — только токены ERA. Страницы отрасли и продукта используют тот же компонент.
- Совместимо с починенной шапкой: одна secondary «Калькулятор», одна primary пробного периода, демо не дублируется в шапке.

Коммиты не делай.
