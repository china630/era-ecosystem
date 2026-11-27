# Промт для Cursor: публичный сайт ERA 365 (домен, структура, отрасли, EN, демо)

Роль: ты разработчик сайта ERA 365. Репозиторий `D:\My Projects\era-ecosystem`. Публичный сайт и кабинет живут в одном Next.js-приложении `era-orchestrator/apps/web` (Next 15 App Router, React 19, Tailwind 4, next-intl, lucide-react). Пути ниже относительно `era-orchestrator/apps/web`, если не указано иное. Пути вида `traefik/...`, `docker/...` относительно корня репозитория.

Это одна большая задача из нескольких частей. Делай по шагам из §14, после каждого шага проверяй критерии из §15.

---

## 0. Что решил владелец (обязательные решения)

1. **Домен.** Публичный сайт (лендинг, решения, отрасли, цены, калькулятор, демо, контакты) открывается **напрямую на `https://era-365.online`, без редиректа**. Кабинет, вход и регистрация остаются на `https://app.era-365.online`. Сейчас `era-365.online` отдаёт 308 на `app.era-365.online`, это надо убрать (§2).
2. **Модель «продукты и отрасли».** Сателлит = **продукт** (мега-меню «Решения», страницы `/satellites/*`). Индустрия = **сфера экономики** (мега-меню «Отрасли», страницы `/industries/[slug]`), каждая индустрия это **готовый набор из 5–6 сателлитов**, собранный под отрасль. Связь «индустрия → сателлиты» живёт в **одном конфиге** (§4). В публичных подписях слова «спутник / сателлит» не используем: пишем «продукт» или «решение». В коде и в URL `/satellites/*` слово остаётся.
3. **Всё, что разрабатывается, показываем как есть**, с бейджем **«Pilot»** там, где продукт ещё не в проде. Банк, лизинг и НБКО, строительство, больница, санаторий показываем (флаг скрытия **убран**). Статус задаётся одним конфигом (§4.3), его легко менять.
4. **Три языка полностью: AZ, RU, EN**, с префиксами в URL `/az`, `/ru`, `/en`, hreflang и редиректами со старых адресов (§3). Перевод на EN делаешь ты, по глоссарию из §3.5.
5. **Заявка на демо падает лидом в наш era-crm** через существующий приём `form_generic`, без нового API в orchestrator (§9).
6. **Контакты** вписаны в §10 (телефон/WhatsApp и корпоративный e-mail). Адреса нет, остаётся пустым.
7. Дизайн и стиль сайта **не меняются** (§1).

## 1. Жёсткие правила

1. **Дизайн.** Источник правды `DESIGN.md` в корне репозитория. Только существующие токены и компоненты: `PRIMARY_BUTTON_CLASS`, `SECONDARY_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`, `CARD_CONTAINER_CLASS`, `LocaleToggle`, `PublicLegalFooter`, `FaqSection` из `@era/satellite-kit/ui`, `LANDING_CARD_HOVER_CLASS` из `lib/landing-motion.ts`, `LandingPageShell`. Палитра: `#34495E`, `#2980B9` (hover `#2471A3`), `#7F8C8D`, `#EBEDF0`, `#D5DADF`. Карточки `rounded-2xl`, кнопки и поля `rounded-lg`. Иконки только `lucide-react` (карта slug → иконка из `components/landing/landing-hub-grid.tsx` вынеси в общий модуль). Новых цветов, шрифтов, теней, радиусов не вводить.
2. **Бейдж «Pilot»** делаешь из существующих токенов: плашка как чипы в `satellite-page-view.tsx` (`XorChips`): `rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] text-[#2471A3] text-[11px] font-medium`. Новый цвет не заводить.
3. **Не редактируй** `packages/satellite-kit/**`, токены, `DESIGN.md`, `/industry/[vertical]` (это авторизованный запуск продукта из кабинета).
4. **Логику калькулятора не трогать.** Запрещено менять: `lib/pricing/quote-calculator.ts`, `quote-selection.ts`, `compute-pricing-totals.ts`, `fetch-public-pricing.ts`, `build-pricing-storefront-view.ts`, `calc-copy.ts` (кроме добавления недостающих ключей, если они нужны шапке; логику не менять). В `components/calc/calc-page-view.tsx` разрешено заменить только `<header>` и футер на общие `SiteHeader` и `SiteFooter`. Пути `/calc` и ссылки `/calc?q=…` продолжают работать.
5. **Ничего не выдумывай про продукт.** Тексты берём из существующих файлов (`landing-copy.ts`, `satellite-page-copy.ts`, `landing-ecosystem-data.ts`, `calc-copy.ts`, `pricing-*-copy.ts`). Любой новый маркетинговый текст помечай `// TODO(copy): подтвердить у владельца`. Логотипы клиентов, кейсы, награды, отзывы, цифры клиентов не придумывать (§11).
6. Не создавай git-коммиты и ветки, не запускай docker, не меняй PATH, версию Node, не ставь новые npm-зависимости (всё уже есть: `zod`, `next-intl`, `lucide-react`).
7. Меню и ссылки должны быть в серверном HTML (интерактив только поверх).
8. **Терминология в публичных строках:** «продукт» или «решение» вместо «спутник/сателлит/peyk» (az: «məhsul», «həll»). Существующие строки со словом «спутник/peyk» в публичных подписях замени.

## 2. Домен: сайт на apex, кабинет на app (убрать редирект)

### 2.1 Где сейчас задан редирект (найдено в репозитории)
- **`traefik/dynamic.yml`**: роутер `apex-redirect` (``rule: Host(`era-365.online`)``, `priority: 100`, entryPoint `websecure`, middleware `apex-to-app`) и middleware `apex-to-app` (`redirectRegex`, `regex: "^https?://era-365\\.online/(.*)"`, `replacement: "https://app.era-365.online/${1}"`, `permanent: true`). Именно он отдаёт 308. Сервис `orchestrator-web` (`http://orchestrator:3000`) уже общий для apex и app.
- `traefik/dynamic.yml`, роутер `http-to-https` (все хосты, приоритет 1): HTTP → HTTPS, оставить.
- `docs/ECOSYSTEM_URLS.md` строка 14: «ERA (apex) … redirect → app», обновить.
- DNS: у `era-365.online` и `app.era-365.online` A-запись `164.92.151.56`. **У `www.era-365.online` записи нет** (NXDOMAIN), поэтому `www` не открывается (внешняя настройка, §16).

### 2.2 Что изменить в репозитории
1. `traefik/dynamic.yml`:
   - роутер `apex-redirect` переименуй в `site-apex`: ``rule: Host(`era-365.online`)``, `entryPoints: [websecure]`, `tls.certResolver: letsencrypt`, **без middleware**, `service: orchestrator-web`;
   - добавь роутер `site-www`: ``rule: Host(`www.era-365.online`)``, websecure, tls letsencrypt, `middlewares: [www-to-apex]`, `service: noop` (или orchestrator-web), `priority` выше;
   - middleware `apex-to-app` удалить, добавить `www-to-apex`: `redirectRegex`, `regex: "^https?://www\\.era-365\\.online/(.*)"`, `replacement: "https://era-365.online/${1}"`, `permanent: true`;
   - `http-to-https` не трогать (ACME-исключение сохранить).
   - файл подключён как bind mount и `watch: true` в `traefik/traefik.yml`, так что на сервере достаточно обновить файл.
2. **Маршрутизация по host в одном приложении**: `middleware.ts` (сейчас занят только MDM-proxy и referral-redirect). Добавь **перед** остальной логикой, не ломая MDM-ветку:
   - Константы из env: `SITE_ORIGIN` (по умолчанию `https://era-365.online`, переменная `NEXT_PUBLIC_SITE_ORIGIN`) и `APP_ORIGIN` (`https://app.era-365.online`, `NEXT_PUBLIC_APP_ORIGIN`). В dev (localhost) никаких host-редиректов.
   - Публичные пути (маркетинг): `/`, `/satellites*`, `/industries*`, `/pricing`, `/calc`, `/calculator`, `/demo`, `/help`, `/terms`, и их версии с префиксом языка (`/az|ru|en/...`).
   - Пути кабинета: `/login`, `/register`, `/register-org`, `/kafe`, `/sso/*`, `/organizations`, `/workspace*`, `/settings*`, `/holdings`, `/partner`, `/portal*`, `/access-denied`, `/super-admin*`, `/industry/*`, `/agency/*`, `/buyer/*`, `/tablet-apps/*`, `/api/*`.
   - Host = apex (`era-365.online`): публичные пути отдаём сайтом (после языковой логики §3); пути кабинета → `308` на `${APP_ORIGIN}${path}${search}`; `www` → `308` на apex (на случай, если трафик придёт мимо Traefik).
   - Host = `app.era-365.online`: пути кабинета отдаём как сейчас; **публичные маркетинговые пути** (`/satellites*`, `/industries*`, `/pricing`, `/calc`, `/calculator`, `/demo`) → `308` на `${SITE_ORIGIN}/{locale}{path}${search}` (старые ссылки, включая `/calc?q=…`, продолжают работать). `/help` и `/terms` остаются доступными на обоих хостах (на них ссылаются страницы входа), канонический URL указывает на apex.
   - **Корень `/` на app-хосте**: это вход в кабинет. Клиентский компонент: `ready && token` → `/workspace` (или `/organizations`, как сейчас), `ready && !token` → `window.location.replace(SITE_ORIGIN)`. Серверный лендинг на app-хосте больше не рендерится (в `home-page-client.tsx` ветка гостя заменяется этим редиректом, лендинг отдаётся только на apex через `app/[locale]/page.tsx`).
3. **Ссылки «Войти» и «Регистрация»** на публичных страницах (шапка, мобильное меню, hero, футер, финальная CTA, `/demo`) ведут на **абсолютные** адреса кабинета: `${APP_ORIGIN}/login`, `${APP_ORIGIN}/register-org`. Вынеси в `lib/site-origins.ts` (`appUrl(path)`, `siteUrl(path, locale)`), чтобы не писать домены руками. Кнопка «Калькулятор» и остальная навигация сайта внутри apex остаются относительными.
4. **Canonical, sitemap, robots** строятся от `SITE_ORIGIN` (§12). На app-хосте для `/help`, `/terms` canonical указывает на apex; страницы кабинета получают `robots: noindex`.
5. **Куки и вход не должны сломаться.**
   - Токены кабинета лежат в `localStorage` (`lib/auth-context.tsx`, `lib/orch-api.ts`), то есть привязаны к origin `app.era-365.online`. Вход и регистрация происходят только на app, поэтому apex их не затрагивает. Ничего не переносить.
   - Кука языка `era_i18n_lang` (`ERA_I18N_COOKIE`) сейчас ставится без `Domain` (`lib/locale-client.ts:12`). Добавь `Domain=.era-365.online` **только когда hostname оканчивается на `.era-365.online` или равен `era-365.online`**, чтобы язык, выбранный на сайте, подхватывался кабинетом. Проверь также серверную установку куки в `/api/locale` (rewrite на orchestrator `/v1/locale`, `era-orchestrator/apps/api`): если там `Set-Cookie` без `Domain`, поправь аналогично.
   - `lib/platform-origin.ts`: условие `host === "app.era-365.online" || host.endsWith(".era-365.online")` не захватывает apex; добавь `host === "era-365.online"`.
6. **Env и сборка**: добавь `NEXT_PUBLIC_SITE_ORIGIN` и `NEXT_PUBLIC_APP_ORIGIN` в `.env.production.example` (рядом с `ERA_APP_ORIGIN`, строка 52, и `NEXT_PUBLIC_ORCH_WEB_URL`, строка 70), в `era-orchestrator/Dockerfile` (ARG/ENV рядом со строками 40–47), в `.github/workflows/build-images.yml` (build-args рядом со строкой 192). Значения: `https://era-365.online` и `https://app.era-365.online`. `NEXT_PUBLIC_ORCH_WEB_URL` оставить на app (его используют сателлиты для SSO и регистрации).
7. Smoke: `scripts/ecosystem-smoke-http.ps1` (строка 4, список хостов): добавь проверку `era-365.online` `/` (ожидается 200, **без** 3xx) и `www.era-365.online` (ожидается 308 на apex). `.cursor/skills/era-git-ship/scripts/era-ship.ps1:548` (проверка `https://app.era-365.online/`) оставь, добавь apex.
8. Не менять поддомены сателлитов (`crm.`, `hotel-pms.` и т. д.) и `tablet-apps` (остаются на `app.era-365.online/tablet-apps`).

### 2.3 Критерии
- `curl -sI https://era-365.online/az` → `200`, нет `Location`.
- `curl -sI https://era-365.online/satellites/hotel` → `308` на `/az/satellites/hotel` (языковой редирект §3.4), не на app.
- `curl -sI https://app.era-365.online/satellites/hotel` → `308` на `https://era-365.online/az/satellites/hotel`.
- `curl -sI https://era-365.online/login` → `308` на `https://app.era-365.online/login`.
- `curl -sI https://www.era-365.online/x` → `308` на `https://era-365.online/x` (после DNS из §16).
- `curl -sI http://era-365.online/` → `308` на `https://era-365.online/` (не на app).
- На app: `/login`, `/workspace`, `/register-org`, `/industry/*`, `/tablet-apps/*` работают как раньше.

## 3. Языки: AZ / RU / EN с префиксами в URL

### 3.1 Что есть сейчас (важно для оценки объёма)
- `messages/{az,ru,en}.json` (next-intl): **полные**, около 2520 ключей в каждом, английский без кириллицы, расхождение в один ключ (проверь и выровняй, `Compare-Object` по плоским ключам). Это в основном кабинет; публичные пространства там: `meta`, `home`, `help`, `login`, `register`, `registerOrg`, `kafe`, `terms`, `common`, `nav`, `industry`, `partner`.
- Публичные тексты сайта лежат **не в messages, а в TS-модулях**, и в них **только az и ru**: `lib/i18n/landing-copy.ts` (az: строка ~429, ru: ~155, `getLandingMarketingCopy` для `en` отдаёт az), `landing-ecosystem-data.ts`, `satellite-page-copy.ts` (`locale === "ru" ? ru : az`), `pricing-storefront-copy.ts`, `pricing-meters-copy.ts`. **EN есть только у `calc-copy.ts`.**
- `lib/public-locale.ts` `resolvePublicAzRuLocale()` намеренно исключает `en`.
- Тумблер языка (`LocaleToggle`) показывает AZ/RU/EN, но на публичных страницах EN даёт az-текст.

### 3.2 Что сделать
1. **EN-пакеты** для всех публичных TS-модулей: `landing-copy.ts`, `landing-ecosystem-data.ts`, `satellite-page-copy.ts`, `pricing-storefront-copy.ts`, `pricing-meters-copy.ts`. Типы `LandingMarketingCopy`, `SatelliteCopyPack` и т. д. уже требуют полную форму, TypeScript покажет недостающие поля. Структуру не менять, ключи те же. Функции `get…Copy(locale)` должны принимать `Locale = "az" | "ru" | "en"` и отдавать пакет без fallback на az.
2. **Новые тексты сайта** (меню, футер, страницы отраслей, `/demo`, `/calculator`, бейдж Pilot, карточки бандлов) пишешь **в next-intl**: новое пространство `site` в `messages/{az,ru,en}.json` (подпространства `site.nav`, `site.footer`, `site.industries`, `site.bundles`, `site.demo`, `site.calculator`, `site.status`, `site.seo`). В новом коде не создавай новых двуязычных TS-пакетов. Серверные компоненты берут `getTranslations({ locale, namespace: "site" })`, клиентские `useTranslations("site")` через `NextIntlClientProvider locale={locale}`.
3. Унифицируй публичный язык: тип `Locale` из `@era/i18n-common`; удали из публичной части `resolvePublicAzRuLocale` (оставь, если его используют не публичные страницы) и переведи страницы на параметр маршрута.
4. Тумблер языка на сайте это **ссылки** на ту же страницу с другим префиксом (`<a hreflang>`), а не состояние React; кука `era_i18n_lang` ставится дополнительно (для кабинета).
5. Проверка полноты: добавь скрипт `scripts/check-i18n-parity.mjs` (в `era-orchestrator/apps/web/scripts/`, там уже есть папка) или тест, который сравнивает плоские ключи `messages/az|ru|en.json` и падает при расхождении. Не запускай тяжёлые тесты, достаточно самого скрипта.
6. EN-правило: если для маркетингового ключа в EN нет перевода, сборка не должна молча подставлять az или ru (тест из п. 5 это ловит).

### 3.3 Префиксы в URL
- Структура: публичные страницы переезжают в сегмент `app/[locale]/…`: `[locale]/page.tsx` (главная), `[locale]/satellites/page.tsx`, `[locale]/satellites/[slug]/page.tsx`, `[locale]/industries/page.tsx`, `[locale]/industries/[slug]/page.tsx`, `[locale]/pricing/page.tsx`, `[locale]/calc/page.tsx`, `[locale]/calculator/page.tsx`, `[locale]/demo/page.tsx`, `[locale]/help`, `[locale]/terms`. `generateStaticParams` возвращает `["az","ru","en"]`; для неизвестной локали `notFound()`.
- Существующие компоненты (`LandingPageView`, `SatellitePageView`, `PricingPageView`, `CalcPageView`) принимают `initialLocale` и продолжают работать, их просто вызывают из новых страниц с локалью из params. Внутри них относительные ссылки (`/pricing`, `/calc`, `/satellites/...`) заменяются на `siteUrl(path, locale)` или `<Link href={"/" + locale + "/..."}>` (хелпер `lib/site-origins.ts`).
- Кабинет (`/workspace`, `/settings`, `/login` и т. д.) **остаётся без префикса** на app-хосте.
- Корневой `app/layout.tsx`: `<html lang>` должен соответствовать языку страницы. Через `middleware.ts` положи локаль маршрута в заголовок запроса (`x-era-locale`; в проекте уже есть `eraPathnameRequestHeaders` из `@era/satellite-kit/auth/middleware-edge`, не меняй пакет, добавь заголовок рядом) и прочитай его в `i18n/request.ts`/`layout.tsx`. Для кабинета поведение прежнее (кука).
- `/calc?q=…` без префикса и `/ru/calc?q=…` дают тот же калькулятор с тем же состоянием.

### 3.4 Редиректы со старых адресов
В `middleware.ts` (apex-хост), `308 Permanent`:
- `/` → `/{locale}`; `/satellites`, `/satellites/{slug}`, `/pricing`, `/calc`, `/help`, `/terms` и любой публичный путь без префикса → `/{locale}{path}` с сохранением query.
- `{locale}` = язык из куки `era_i18n_lang`, иначе из `Accept-Language` (az/ru/en), иначе `az`.
- На app-хосте тот же набор идёт на apex с префиксом (§2.2).
- Боты: правило одинаковое, редирект постоянный.

### 3.5 Глоссарий для английской версии (единые термины)
Бренд и имена продуктов не переводятся: ERA 365, ERA Core, Hotel PMS, Clinic, F&B POS, Retail POS, Auto Service (в старых строках «Auto STO», в EN писать **Auto Service**), Logistics, Construction, Wholesale, CRM (в старых строках «CRM Field», в EN **CRM**), Bank CBS, Data HUB, Workforce, Foundation, Gate, Trial, VÖEN, NAS/MMUS, IFRS, e-qaimə, e-taxes, Tax Pro, Trade Pro, Compliance Pro, 1C, AzeriCard, AZIPS, PIN, KDS, SKU, SSO, AML, OCR, API.

| ru | az | en |
|---|---|---|
| Решения | Həllər | Solutions |
| Отрасли / Отраслевые решения | Sənaye həlləri | Industries |
| продукт (бывш. спутник) | məhsul (bu mənada «peyk» yazma) | product |
| Тарифы | Tariflər | Pricing |
| Калькулятор | Kalkulyator | Calculator |
| Запросить демо | Demo sifariş et | Request a demo |
| Начать 3 месяца бесплатно | 3 ay tam pulsuz başla | Start 3 months free |
| Войти | Daxil ol | Sign in |
| Регистрация | Qeydiyyat | Sign up |
| Пилот (бейдж) | Pilot | Pilot |
| Учёт (бухгалтерский) | Uçot | Accounting |
| Касса и банк | Kassa və bank | Cash and bank |
| Склад | Anbar | Warehouse |
| Производство и НЗП | İstehsalat və NAT | Manufacturing and work in progress (WIP) |
| Основные средства | Əsas vəsaitlər | Fixed assets |
| Кадры и зарплата | Kadr və əməkhaqqı | HR and payroll |
| НДС | ƏDV | VAT |
| Нац. стандарты бух. учёта | Milli Mühasibat Uçotu Standartları | National Accounting Standards (NAS / MMUS) |
| Модуль | Modul | Module |
| Пакет | Paket | Bundle |
| Платформенные add-on | Platforma add-on | Platform add-ons |
| Справочники и обмен | Soraqçalar və mübadilə | Reference data and exchange |
| Бронь / шахматка | Rezervasiya / şahmat cədvəli | Reservation / room chart |
| Фолио гостя | Qonaq folio | Guest folio |
| Ночной аудит | Gecə auditi | Night audit |
| Уборка (HK) | Otaq təmizliyi (HK) | Housekeeping (HK) |
| Канал-менеджер / дистрибуция | Distribusiya | Channel manager / distribution |
| Санаторий | Sanatoriya | Sanatorium |
| Стационар / койки | Stasionar / çarpayı | Inpatient / beds |
| Больница | Xəstəxana | Hospital |
| Клиника | Klinika | Clinic |
| ЭМК | EMR (elektron tibbi qeyd) | EMR (electronic medical record) |
| Лаборатория | Laboratoriya | Laboratory |
| Страхование (медицинское) | Sığorta | Insurance |
| График медсестёр | Tibb bacıları cədvəli | Nurse roster |
| Кабинет (врача) | Kabinet | Room (treatment room) |
| Зал, кухня KDS | Zal, KDS mətbəx | Dining room, kitchen display (KDS) |
| Касса (POS) | Kassa (POS) | Register (POS terminal) |
| Точка доставки | Çatdırılma | Delivery hub |
| Пост (автосервис) | Post | Service bay |
| Заказ-наряд | İş əmri | Work order |
| Путевой лист | Yol vərəqəsi | Waybill |
| Водитель, POD | Sürücü, POD | Driver, proof of delivery (POD) |
| Площадка / объект | Obyekt | Site |
| Смета | Smeta | Estimate (BOQ) |
| Акт выполненных работ | Görülmüş işlərin aktı | Completion certificate |
| Субподряд | Subpodrat | Subcontracting |
| Опт / дистрибуция | Topdan satış | Wholesale / distribution |
| Кредитный лимит | Kredit limiti | Credit limit |
| Лид | Lead | Lead |
| Полевые визиты | Sahə vizitləri | Field visits |
| Единый инбокс | Omni inbox | Omnichannel inbox |
| Банк (CBS/АБС) | Bank (CBS) | Core banking system (CBS) |
| ДБО | DBO (rəqəmsal bank) | Digital banking (online and mobile banking) |
| НБКО | BOKT (bank olmayan kredit təşkilatı) | Non-bank credit organization (NBCO) |
| Лизинг | Lizinq | Leasing |
| Кредиты, депозиты, платежи | Kreditlər, depozitlər, ödənişlər | Loans, deposits, payments |
| Регуляторная отчётность | Tənzimləyici hesabatlar | Regulatory reporting |
| Филиал | Filial | Branch |
| Sandbox / Pilot | Sandbox / Pilot | Sandbox / Pilot |
| Шифрование на клиенте, нулевой доступ | Lokal şifrələnmə, sıfır giriş | Client-side encryption, zero access (Zero-Knowledge) |
| Заявка на демо | Demo sorğusu | Demo request |
| Вопросы и ответы | Tez-tez verilən suallar | FAQ |
| Условия / Конфиденциальность / Статус | Şərtlər / Məxfilik / Status | Terms / Privacy / Status |
| в месяц | ay | per month |

Стиль EN: короткие деловые фразы, заголовки в sentence case, без рекламных превосходных степеней, сумма как `29 AZN / month`, форматирование чисел через `Intl.NumberFormat("en")`. Существующие английские строки калькулятора (`calc-copy.ts`) считай эталоном терминов.

## 4. Модель данных: продукты, отрасли, бандлы, статусы (один конфиг)

### 4.1 Файл и форма
Создай `lib/catalog/site-catalog.ts`. Это **единственный** источник для мега-меню «Решения» и «Отрасли», карточек, страниц, футера, sitemap, бейджей и ссылок в калькулятор. Нигде больше списки продуктов и отраслей не дублируй (в том числе `public-satellite-catalog.ts` должен брать данные отсюда или экспортироваться из него).

Форма:

```ts
export type Maturity = "prod" | "pilot";

export type SatelliteDef = {
  slug: PublicSatelliteSlug;          // /satellites/{slug}; добавь "workforce" (§4.4)
  kind: "core" | "industry" | "platform";
  gateKey: string | null;             // ключ калькулятора, напр. "industry_hotel_pms"
  extraCalcKeys?: string[];           // дополнительные модули по умолчанию
  maturity: Maturity;                 // §4.3
  evidence: string;                   // откуда статус (файл и строка матрицы)
  moduleMaturity?: Record<string, Maturity>; // отдельные модули, если они pilot
};

export type BundleItem = {
  satellite: PublicSatelliteSlug;
  anchor?: string;                    // якорь на странице продукта, напр. "dbo"
  role: "core" | "included" | "optional";
  maturity?: Maturity;                // override статуса продукта в этом бандле
  assumption?: boolean;               // состав выведен допущением, подтвердить
};

export type IndustryDef = {
  slug: string;                       // /industries/{slug}
  group: "hospitality_health" | "finance" | "trade_service" | "projects";
  icon: LucideIconName;
  bundle: BundleItem[];               // 5–6 продуктов
  maturity?: Maturity;                // если не задан: pilot, если pilot хотя бы у одного core-продукта
  calcExtraKeys?: string[];           // §8
};
```

Функции: `industryMaturity(i)`, `satellitesOfIndustry(i)`, `industriesOfSatellite(slug)` (обратная связь), `calcHrefForIndustry(i)` (§8). Статусы в публичной части выводит только этот модуль.

### 4.2 Продукты (сателлиты), их ключи и статусы
Источники: `lib/satellites/public-satellite-catalog.ts` (12 публичных slug), `@era/satellite-kit/platform/industry-modules` (`INDUSTRY_NAV_ITEMS`, 10 отраслевых ключей), `era-orchestrator/packages/database/prisma/lib/core/pricing-catalog-canon.ts` (`CAPACITY_DRIVERS`, `INDUSTRY_SUBMODULE_PREFIX_TO_GATE`, `CATALOG_PALETTE_AZN`), `pricing-module-seed.ts` (ключи модулей).

| slug | Продукт | gateKey (калькулятор) | Статус | Основание (docs/acceptance/*-Product-Readiness-Matrix.md) |
|---|---|---|---|---|
| finance | ERA Core (учёт NAS/MMUS) | foundation | prod | Gate ✅ BE ✅ UI 🟡, «many FIN-* API-only» `[допущение]` |
| hotel | Hotel PMS | industry_hotel_pms | prod | Gate/BE/UI/Demo ✅, «mvp showable; KKM STUB» |
| fnb | F&B POS | industry_fnb_pos | prod | Gate ✅ BE ✅ UI 🟡 `[допущение]` |
| auto | Auto Service | industry_auto_service | prod | Gate ✅ BE ✅ UI 🟡 `[допущение]` |
| logistics | Logistics | industry_logistics | prod | Gate ✅ BE ✅ UI 🟡 `[допущение]` |
| wholesale | Wholesale | industry_wholesale | prod | Gate ✅ BE ✅ UI 🟡 `[допущение]` |
| crm | CRM | industry_crm | prod | Gate ✅ BE ✅ UI 🟡; аудит CRM v5: 33 из 56 закрыто `[допущение]` |
| workforce | Workforce | platform_workforce_base (XOR base/pro/premium) | prod | `[допущение]`, Platform matrix BE 🟡 |
| clinic | Clinic | industry_clinic | **pilot** | Clinic matrix: UI 🟡, «fiscal/HL7 STUB; pilot open»; аудит клиники: 1 готово, 15 частично, 13 нет |
| retail | Retail POS | industry_retail | **pilot** | Retail matrix: «fiscal/marketplace field open» |
| construction | Construction | industry_construction | **pilot** | Construction matrix: «lab templates open; field/ga closed»; gap-анализ: 5 есть, 20 частично, 7 нет |
| banking | Bank CBS (+ДБО) | industry_banking | **pilot** | Bank matrix: «Full commercial CBS … Pilot field ⏸ partner; ≠ ga»; Bank DBO: `pilot_ready:false`; сайт уже называет это Sandbox/Pilot |
| data-hub | Data HUB | platform_reference_data | **pilot** | Data-Hub matrix: BE 🟡, «API product; pilot/field open» |

Общее: **все** редакции в `docs/editions/*.yaml` имеют `status: mvp`, `pilot_ready: false`, а в readiness-матрицах везде «do not claim GA». Поэтому «prod» здесь означает «работает на пилотных/trial-клиентах без бейджа»; правило отнесения к pilot: в строке «Sell / show» матрицы есть STUB/field open/lab-only по основному сценарию или BE не ✅ (исключение: Hotel, у него «mvp showable»). Конфиг делается так, чтобы владелец менял статус одной строкой. Не перетирай статусы по своему усмотрению, переопределять можно только в `site-catalog.ts` с обновлением поля `evidence`.

Модули внутри продукта с отдельным статусом `pilot` (отображаются как «Pilot» рядом с названием модуля): `clinic_sanatorium`, `clinic_inpatient`, `clinic_telehealth`, `hotel_medical_sanatorium`, `banking_dbo`, `banking_loans` (лизинг/НБКО), `banking_collections`. `[допущение]` по именам ключей: сверь с `pricing-module-seed.ts`.

### 4.3 Как отображать статус
- Продукт или отрасль со `maturity: "pilot"` получают бейдж «Pilot» (§1.2) в: карточках, заголовке страницы, пункте мега-меню, карточке бандла.
- Подпись по наведению/в подвале страницы (ключ `site.status.pilotNote`, `TODO(copy)`): «Продукт в пилотной эксплуатации: функциональность и условия уточняйте у нас» (ru), аналоги az/en.
- У банка сохраняется существующий текст `bankNote` и подпись «Sandbox / Pilot». Бейдж «Pilot» добавляется, текст не удаляется.
- Статус индустрии считается автоматически: pilot, если pilot хотя бы у одного продукта с `role: "core"`. Можно переопределить полем `maturity`.

### 4.4 Новая публичная страница продукта `workforce`
Workforce входит в каждую отрасль, но отдельной публичной страницы нет (есть только add-on «Workforce 2/4 AZN» в `hub.addonsBody`, ключи `platform_workforce_base|pro|premium`, ставки `WORKFORCE_HEADCOUNT_RATE_AZN` в `pricing-catalog-canon.ts`). Добавь slug `workforce` в `PUBLIC_SATELLITE_SLUGS` (`kind: "platform"`, `pricingAnchor: "addons"`, `pricingKey: "platform_workforce_base"`) и страницу по шаблону §6.1; тексты только из существующих строк (кабинет: `workforce*` в `messages/*.json`, `lib/workforce-packages.ts`, `lib/workforce-satellites.ts`, пакеты в калькуляторе), остальное `TODO(copy)`.
Для `banking`: якорь `#dbo` (модуль «Цифровой банкинг / ДБО») и `#loans-leasing` на существующей странице. Отдельную страницу ДБО не создавай.

### 4.5 Бандлы: состав 12 отраслей
Состав выведен из реальных продуктов и ключей (см. §4.2), из калькулятора (`quote-selection.ts`: `HOTEL_CITY`, `HOTEL_RESORT`, `HOTEL_SANATORIUM` и пресеты `sanatorium`, `clinic`, `kafe`, `retail`) и из примеров владельца. Роль: **C** = core (ядро отрасли), **I** = входит в набор, **O** = опционально. «Pilot» в колонке = статус продукта по §4.2. Допущения помечены ⚑ и их надо подтвердить.

| Отрасль (slug) | Состав бандла (роль) | Статус отрасли |
|---|---|---|
| Отели (`hotels`) | Hotel PMS (C), F&B POS (I), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot) ⚑ | prod |
| Санатории (`sanatoriums`) | Hotel PMS + модуль санатория (C), Clinic (C, Pilot), F&B POS (I), Retail POS (I, Pilot), ERA Core (I), Workforce (I), CRM (O) | **Pilot** |
| Клиники (`clinics`) | Clinic (C, Pilot), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot, аптечный киоск ⚑) | **Pilot** |
| Больницы (`hospitals`) | Clinic + стационар и график медсестёр (C, Pilot), ERA Core (I), Workforce (I), F&B POS (I, столовая ⚑), Retail POS (O, Pilot, аптека ⚑), CRM (O) | **Pilot** |
| Рестораны и кафе (`restaurants`) | F&B POS (C), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot) ⚑ | prod |
| Банки (`banks`) | Bank CBS (C, Pilot), Bank CBS · ДБО и клиентские приложения (`banking#dbo`, C, Pilot), Workforce (I), ERA Core (управление финансами, I), CRM (I), Data HUB (O, Pilot, регуляторные справочники ⚑) | **Pilot** |
| Лизинг и НБКО (`leasing-nbco`) | Bank CBS · кредиты и лизинг (`banking#loans-leasing`, C, Pilot), Bank CBS · ДБО (кабинет заёмщика, I, Pilot), ERA Core (I), Workforce (I), CRM (I), Data HUB (O, Pilot) | **Pilot** |
| Розница (`retail`) | Retail POS (C, Pilot), ERA Core (I), CRM (I), Workforce (I), Wholesale (O), Data HUB (O, Pilot) ⚑ | **Pilot** |
| Опт и дистрибуция (`wholesale`) | Wholesale (C), ERA Core (I), Logistics (I), CRM (I), Workforce (I), Retail POS (O, Pilot) ⚑ | prod |
| Автосервис (`auto-service`) | Auto Service (C), ERA Core (I), CRM (I, модуль гарантии), Workforce (I), Retail POS (O, Pilot, магазин запчастей ⚑) | prod |
| Логистика (`logistics`) | Logistics (C), ERA Core (I), Workforce (I), CRM (I), Wholesale (O), Auto Service (O, парк ⚑) | prod |
| Строительство (`construction`) | Construction (C, Pilot), CRM (I), ERA Core (I), Workforce (I), Logistics (I, техника и перевозки ⚑), Wholesale (O, закупка материалов ⚑) | **Pilot** |

Если `I` и `C` в сумме меньше пяти, добери из `O`; максимум шесть карточек на отрасль, остальное только в блоке «Дополнительно». Любую строку можно править в `site-catalog.ts`, на сайте ничего не хардкодь.

## 5. Мега-меню и информационная архитектура

### 5.1 Шапка (desktop)
`Логотип ERA 365` → **Решения ▾** → **Отрасли ▾** → Тарифы → Ресурсы ▾ → (справа) язык AZ/RU/EN → **[Калькулятор]** (акцентная кнопка с иконкой `Calculator`) → Войти (ghost) → **[Запросить демо]** (secondary) → **[Начать 3 месяца бесплатно]** (primary). «Войти» и «Начать…» ведут на `appUrl(...)` (§2.2), остальное внутри сайта.
Панели «Решения», «Отрасли», «Ресурсы»: раскрытие по наведению с задержкой ~120 мс **и** по клику/Enter/Space.

### 5.2 «Решения» (продукты)
Источник: `SATELLITES` из `site-catalog.ts`. Группы:
- **Основа платформы**: ERA Core (`/satellites/finance`) с подпунктами (Касса и банк, Склад, Производство и НЗП, Основные средства, Кадры и зарплата, якоря `#cash-bank`, `#warehouse`, `#manufacturing`, `#fixed-assets`, `#hr-payroll`), Workforce (`/satellites/workforce`), Data HUB (`/satellites/data-hub`, Pilot), Платформенные add-on (`/pricing#addons`), Расширения Finance Premium: Tax Pro, Trade Pro, Compliance Pro (`/satellites/finance#premium`).
- **Отраслевые продукты**: Hotel PMS, Clinic, F&B POS, Retail POS, Auto Service, Logistics, Construction, Wholesale, CRM, Bank CBS (все `/satellites/{slug}`), у Pilot-продуктов бейдж.
- Строка «Безопасность Zero-Knowledge» → `/{locale}#security` (добавь `id="security"` секции `LandingZeroKnowledge`).
- Внизу «Все решения» → `/satellites`. Справа карточка-витрина калькулятора (§8): «Соберите подписку за пару минут» → кнопка «Открыть калькулятор» → `/calc`; событие `cta_calc_click { location: "megamenu_solutions" }`.

### 5.3 «Отрасли» (бандлы)
Источник: `INDUSTRIES`. Три колонки по `group`:
- Гостеприимство и здоровье: Отели, Санатории, Клиники, Больницы, Рестораны и кафе (подпункт «Быстрый старт для кафе» `[допущение]` → `appUrl("/kafe")`).
- Финансы: Банки, Лизинг и НБКО.
- Торговля, сервис, проекты: Розница, Опт, Автосервис, Логистика, Строительство.
**Состав бандла показывается в самом меню**: при наведении или фокусе на отрасль справа открывается панель предпросмотра «Что входит»: до шести карточек-чипов продуктов (иконка + название + бейдж Pilot) со ссылками на `/satellites/{slug}` (или на якорь `#dbo`). На мобильных эта панель раскрывается внутри аккордеона отрасли. У отрасли с Pilot бейдж рядом с названием. Внизу «Все отрасли» → `/industries`. Справа карточка калькулятора (`location: "megamenu_industries"`).

### 5.4 «Ресурсы»
Вопросы и ответы (`/help`), Калькулятор подписки (`/calc`), Тарифы (`/pricing`), Партнёрам (`appUrl("/partner")`, это кабинет), Контакты (`/demo#contacts`), Условия (`/terms`). Блог, исследования, вебинары не создавать.

### 5.5 Тексты навигации
Все строки в `messages/{az,ru,en}.json` пространство `site.nav` (значения брать из глоссария §3.5). Основные: `solutions`, `industries`, `pricing`, `resources`, `calculator`, `login`, `signup`, `ctaDemo`, `ctaTrial`, `allSolutions`, `allIndustries`, `includes` («Что входит»), `pilot`, `calcCardTitle`, `calcCardCta`, `menuOpen`, `menuClose`. Новые (`ctaDemo`, `calcCard*`, `includes`) помечай `TODO(copy)`.

## 6. Шаблоны страниц

### 6.1 Страница продукта `/{locale}/satellites/[slug]` (`satellite-page-view.tsx`)
Блоки: 1) Hero (kicker, H1, tagline, бейдж Pilot если нужно; CTA: primary «Начать…», secondary «Запросить демо», акцентная «Калькулятор»); 2) якорная навигация («Что внутри», «Цены», «Для каких отраслей», «Вопросы»); 3) «Что внутри» (`gateBullets` + живые модули и цены `LiveModules`, у Pilot-модулей бейдж); 4) **«Для каких отраслей»**: карточки отраслей из `industriesOfSatellite(slug)`; 5) цены (`catalogNote`, ссылка на `/pricing#anchor`, плашка «Посчитать в калькуляторе» → `/calc` с предвыбором продукта по §8); 6) связанные продукты (2–3); 7) FAQ (если есть); 8) финальная CTA. У `banking` остаётся `bankNote`. У `finance` якоря из §5.2.

### 6.2 Страница отрасли `/{locale}/industries/[slug]`
`generateStaticParams` по `INDUSTRIES` × локали. Блоки:
1. Hero: H1 «ERA 365 для {отрасль}» (`TODO(copy)`), подзаголовок из tagline core-продукта, бейдж Pilot если нужно, CTA: primary «Начать…», secondary «Запросить демо», акцентная «Калькулятор» (с предвыбором, §8).
2. **«Из чего собрано решение»**: сетка карточек продуктов бандла (иконка, название, одна строка из `tagline` продукта, бейдж Pilot, роль core/included/optional, ссылка на `/satellites/{slug}`; у `anchor` ссылка на якорь). Это главный блок страницы.
3. «Что получает {отрасль}»: 3–5 тезисов только из `gateBullets` и модулей продуктов бандла. Для санатория и больницы данные Clinic (санаторий, стационар, EMR, лаборатория) и Hotel PMS (HK, SPA); никаких новых функций.
4. Модули и цены (живые данные `fetchPublicPricingSnapshot`; если снимок недоступен, текст «Цены в каталоге» и ссылка на `/pricing#anchor`).
5. **Блок калькулятора** отрасли: «Посчитайте стоимость для {отрасль}», кнопка с предвыбором (§8).
6. Доверие: `TrustStrip` (§11) выключен; вместо него факт «Первые 3 месяца 0 AZN».
7. FAQ: 2–3 вопроса из общего FAQ.
8. Финальная CTA. Для Pilot-отраслей, внизу, `site.status.pilotNote`.
Для `banks` текст `bankNote` и «Sandbox / Pilot» обязательны; для `leasing-nbco` (и других отраслей, где `assumption`) добавь пометку «Pilot».

### 6.3 `/{locale}/industries` (индекс)
Заголовок, вводная, сетка карточек по группам (бейдж Pilot, чипы входящих продуктов), внизу карточка калькулятора.

## 7. Главная `/{locale}`
1. **Исправь серверный рендер (P0).** `components/landing/home-page-client.tsx` сегодня рисует «Yüklənir…», пока `useAuth().ready` не станет true, поэтому поисковик не видит лендинг. После §2 лендинг отдаётся только на apex через `app/[locale]/page.tsx` как серверный компонент (`LandingPageView` без ожидания `useAuth`), кабинет на app-хосте использует отдельный клиентский редирект (§2.2).
2. Порядок: шапка → Hero (H1/подзаголовок из `landing-copy.ts`, 3 CTA: «Начать…», «Запросить демо», «Калькулятор») + чипы продуктов → `LandingTrialBanner` → **«Выберите отрасль»** (карточки из `INDUSTRIES` с чипами бандла и бейджем Pilot) → **«Продукты платформы»** (ERA Core, Workforce, Data HUB, CRM, отраслевые продукты, карточки из `SATELLITES`, живые цены как сейчас) → блок калькулятора (тёмная панель как у `LandingBottomCta`) → `LandingZeroKnowledge` (`id="security"`) → `LandingFaq` → `LandingBottomCta` → `SiteFooter`.
3. Мобильные: сетки схлопываются в одну колонку, чипы бандла переносятся.

## 8. Калькулятор: вход и предвыбор

- Кнопка «Калькулятор» выделена (акцентная `SECONDARY_BUTTON_CLASS` с рамкой и текстом `#2980B9`, иконка `Calculator`) в шапке (desktop и мобильное меню), hero, блоке главной, обеих панелях меню, страницах продуктов и отраслей, финальной CTA, футере, `/demo`.
- **Предвыбор набора поддерживается без изменения логики.** Калькулятор читает `?q=` (`calc-page-view.tsx:92`) как **JSON `CalcState`, закодированный `encodeURIComponent`** (`serializeCalcState`/`parseCalcState` в `lib/pricing/quote-selection.ts:227–239`); `normalizeCalcState` подставляет значения по умолчанию для пропущенных полей (foundation=true, erpLogins=1 и т. д.) и применяет `applyCatalogMutex`. Поэтому страница отрасли строит ссылку:
  `/{locale}/calc?q=` + `encodeURIComponent(JSON.stringify({ moduleKeys: [...], capacity: {...} }))`.
  Реализуй `calcHrefForIndustry(industry)` в `lib/catalog/site-catalog.ts`: `moduleKeys` = `gateKey` каждого продукта бандла с `role !== "optional"` + `extraCalcKeys` продукта + `calcExtraKeys` отрасли; `capacity[gateKey] = includedInGate` из `CAPACITY_DRIVERS` (`pricing-catalog-canon.ts`). Перед этим **прочитай** `quote-calculator.ts` и убедись, что отсутствующий `capacity` не даёт ошибочную цену; если даёт, обязательно задавай `capacity`. `bundleIds` не задавай (маркетинговые id приходят из живого снимка цен).
- Готовые пресеты калькулятора (`applyPreset`: `core`, `hotel_city`, `hotel_resort`, `sanatorium`, `clinic`, `kafe`, `retail`) не вызываются из URL (параметра `preset` нет). Их наборы модулей используй как источник `extraCalcKeys`: отели `HOTEL_CITY`, санатории `HOTEL_SANATORIUM` + `clinic_sanatorium`, клиники `clinic_registry_emr`, кафе `industry_fnb_pos`. Для отраслей без пресета (больницы, банки, лизинг, строительство, логистика и др.) бери gate-ключи продуктов бандла и ключи из §4.2; неуверенные ключи помечай `// TODO: проверить по pricing-module-seed.ts`.
- Если какой-то набор нельзя выразить через `q` (ключ не существует в `snapshot.pricingModules`), ссылка ведёт на `/calc` без параметров. Править `quote-*` и калькулятор запрещено.
- Новая лёгкая страница **`/{locale}/calculator`** (SSR): H1 и 3 шага из `calc-copy.ts` (`title`, `quoteTitle`, `share`; без новых функций), блок «Выберите отрасль» (ссылки на `calcHrefForIndustry`), кнопка «Открыть калькулятор» → `/{locale}/calc`, CTA «Запросить демо».
- Оптимизацию самого калькулятора не делать.

## 9. Заявка на демо: в наш era-crm

### 9.1 Что найдено в репозитории
- **era-crm уже принимает публичные формы**: `POST /api/integrations/hooks/form_generic/:publicId` (`era-crm/nest/integrations-routes.ts`, около строк 1590–1830; CRM работает на `crm.era-365.online`, переменная `ERA_CRM_ORIGIN`). Адаптер `packages/integrations-kit/src/providers/form_generic.ts` принимает JSON с полями `name`, `phone`, `email` (или `contactName`/`contactPhone`/`contactEmail`) и `utm_*`; проверка по заголовку `x-webhook-secret`; дальше `normalizer.service.ts:186` создаёт **настоящий `Lead`** (`title`=имя, телефон/e-mail, `channel: "other"`, `isUnsorted: true`, `sourceRef: "form_generic"`), пишет `Activity` с полями формы и шлёт событие `crm.lead.captured`. Антиспам уже есть в CRM: rate limit по IP (`assertPublicRateLimit`) и математическая капча для режима виджета (`public-hook-guard.ts`).
- Публичного API для заявок в orchestrator нет: есть `/v1/public/pricing`, `/v1/public/landing-modules`, `/v1/early-access/*` (требует авторизацию). `register-org` создаёт организацию (`/auth/register-organization`), `partner` это кабинет партнёра. **Новый `POST /v1/public/demo-requests` не создавать.**
- Секрет формы нельзя держать в браузере, поэтому заявку отправляет **серверный маршрут сайта**.

### 9.2 Что сделать
1. `app/api/demo-request/route.ts` (POST, `runtime = "nodejs"`):
   - валидация `zod`: `name` (2–120), `phone` или `email` (хотя бы одно, формат), `company` (до 160), `industry` (slug из `site-catalog.ts`, необязательно), `message` (до 2000), `consent: true`, `locale`, `source` (`header|hero|industry|footer|demo_page`), `utm_*`, `website` (honeypot, должно быть пустым), `t` (метка времени формы);
   - **антиспам:** honeypot-поле, минимальное время заполнения (отклонять, если `now - t < 3 s`), rate limit по IP (например 5 заявок за 10 минут и 30 за сутки; хранение в памяти процесса с очисткой, отметь в комментарии, что при нескольких инстансах нужен общий стор), лимит размера тела, `Content-Type: application/json`, проверка `Origin`/`Referer` по `SITE_ORIGIN`. Математическую капчу CRM не используй (запрос идёт сервер-сервер, не widget-режим). Опционально подготовь переключатель `DEMO_FORM_CAPTCHA=1` для будущей капчи, по умолчанию выключен;
   - **пересылка в CRM:** `POST ${ERA_CRM_ORIGIN}/api/integrations/hooks/form_generic/${ERA_DEMO_FORM_PUBLIC_ID}` с заголовком `x-webhook-secret: ${ERA_DEMO_FORM_WEBHOOK_SECRET}` и телом: `{ name: "<имя> · <компания>", phone, email, company, industry, message, locale, source, utm_source, utm_medium, utm_campaign, page }`. Поле `name` объединяет имя и компанию, потому что `Lead.title` берётся из `name`, а `company`/`industry`/`message` сохраняются в `Activity.payloadJson`. Не логируй секрет и персональные данные;
   - ответы: 200 `{ ok: true }`; 400 валидация; 429 лимит; 503 если env не заданы или CRM недоступна (`{ ok:false, code:"UNAVAILABLE" }`), сообщение пользователю с запасными контактами из §10 (WhatsApp/e-mail). **Форма не должна падать**: без CRM показывает понятное сообщение и контакты.
2. Переменные окружения (добавить в `.env.production.example` и `.env.example`, не заводить значений в репозитории): `ERA_CRM_ORIGIN` (уже есть, `https://crm.era-365.online`), `ERA_DEMO_FORM_PUBLIC_ID`, `ERA_DEMO_FORM_WEBHOOK_SECRET`. Внутри docker-сети можно `ERA_CRM_INTERNAL_URL` (в `docker-compose.yml` не использовать публичный `https://*.era-365.online` из контейнера, там указана петля Traefik); добавь поддержку этой переменной с запасом на `ERA_CRM_ORIGIN`.
3. Форма `/demo` и все кнопки «Запросить демо» (модальное окно на страницах отраслей и продуктов можно не делать, достаточно ссылки на `/{locale}/demo?industry=…&source=…`). Поля формы см. выше, стили через существующие компоненты форм (`h-9`, `rounded-lg`, рамка `#D5DADF`). События `demo_form_submit`, `demo_form_error`.
4. Заметки для владельца в отчёте (не код): в CRM era-365 нужно создать подключение `form_generic` для собственной организации ERA, получить `publicId` и `webhookSecret`, прописать их в env на сервере. Новые заявки появляются в CRM как «неразобранные лиды».

## 10. Контакты (по просьбе владельца публикуются на сайте)

Создай `lib/site-contacts.ts`:

```ts
export const CONTACTS = {
  phone: "+994 77 350 70 70",            // телефон и WhatsApp (один номер)
  phoneTel: "tel:+994773507070",
  whatsappUrl: "https://wa.me/994773507070",
  email: "chingiz@era-365.online",       // корпоративный e-mail, основной контакт
  emailMailto: "mailto:chingiz@era-365.online",
  address: null as string | null,        // TODO(content): адрес не найден ни в коде, ни в доках; не придумывать
  legalName: null as string | null,      // TODO(content)
} as const;
```

Правила: показывать блок только по непустым значениям; телефон подписать «Телефон / WhatsApp» (az «Telefon / WhatsApp», en «Phone / WhatsApp»), WhatsApp ссылкой `wa.me`; e-mail основной контакт, на странице `/demo#contacts`, в футере (колонка «Начать») и в запасном сообщении формы. Личный e-mail владельца **на сайт не ставить**. `ops@era-365.online` (адрес ACME в `traefik/traefik.yml`) контактом не является.

## 11. Блоки доверия
Данных клиентов, кейсов, наград, отзывов в репозитории нет: ничего не выдумывать. Сделай `components/site/trust-strip.tsx`, выключенный флагом `SHOW_TRUST_STRIP = false` в `lib/site-flags.ts`, с `// TODO(content)`. Сейчас можно показывать только факты сайта: «Первые 3 месяца 0 AZN», палитра цен «19 / 29 / 39 / 99 AZN», Zero-Knowledge, сравнение с 1C (уже на страницах продуктов).

## 12. SEO

1. `generateMetadata` на каждой публичной странице: уникальные `title` (≈60) и `description` (≈155) на языке страницы, `alternates.canonical` (абсолютный URL на apex), **`alternates.languages`** (hreflang `az`, `ru`, `en`) и `x-default` (на `/az`), `openGraph` (`siteName: "ERA 365"`, `locale`), `twitter`. Тексты из `site.seo.*` (`TODO(copy)`). Админский description из `messages.meta` остаётся для кабинета (`robots: noindex`).
2. `app/sitemap.ts`: все публичные страницы × 3 локали, у каждой записи `alternates.languages`; включены `/`, `/satellites`, `/satellites/{slug}` (13 с workforce), `/industries`, `/industries/{slug}` (12), `/pricing`, `/calc`, `/calculator`, `/demo`, `/help`, `/terms`. База `NEXT_PUBLIC_SITE_ORIGIN`.
3. `app/robots.ts`: разрешить публичное, запретить `/api`, `/workspace`, `/settings`, `/super-admin`, `/organizations`, `/holdings`, `/portal`, `/industry`, `/access-denied`; ссылка на sitemap на apex.
4. JSON-LD: `Organization` на главной (`name`, `url`, `email`/`telephone` из `CONTACTS`), `BreadcrumbList` на страницах продуктов и отраслей.
5. Каноничные ссылки и меню используют `siteUrl()`. Теги hreflang указывают на реальные URL с префиксами.

## 13. Футер (`SiteFooter`)
Колонки: **Решения** (все продукты из `SATELLITES` + «Все решения»), **Отрасли** (12 из `INDUSTRIES` + «Все отрасли», Pilot-бейдж), **Ресурсы и компания** (Вопросы и ответы, Калькулятор, Тарифы, Партнёрам, Условия, Конфиденциальность), **Начать** (CTA «Начать 3 месяца бесплатно», «Запросить демо», акцентный «Калькулятор», контакты из §10). Под колонками строка `© год + footer` и `PublicLegalFooter` (`appPrefix="ERA365"`, `faqHref` на `/{locale}#faq`). Все ссылки из конфигов, не вручную.

## 14. Порядок работ

1. **Разведка (только чтение):** `DESIGN.md`, `middleware.ts`, `app/layout.tsx`, `i18n/request.ts`, `lib/public-routes.ts`, `lib/public-locale.ts`, `lib/locale-client.ts`, `landing-chrome.tsx` и копии шапки, `traefik/dynamic.yml`, `lib/satellites/public-satellite-catalog.ts`, `quote-selection.ts`, `pricing-catalog-canon.ts`. Запиши расхождения с промтом.
2. `lib/site-origins.ts`, `lib/site-flags.ts`, `lib/site-contacts.ts`, `lib/catalog/site-catalog.ts` (продукты, отрасли, бандлы, статусы, `calcHrefForIndustry`).
3. i18n: пространство `site` в `messages/*.json`, EN-пакеты для TS-модулей, скрипт проверки паритета ключей.
4. Роутинг: `app/[locale]/…`, middleware (host-логика, языковые редиректы, заголовок локали), правка `home-page-client.tsx`, `public-routes.ts`, `platform-origin.ts`, куки с `Domain`.
5. `SiteHeader`, `MegaMenu` (с панелью состава бандла), `MobileMenu`, `SiteFooter`; подключение в лендинг, `calc-page-view.tsx` (только шапка/футер) и `pricing-page-view.tsx`.
6. Главная, шаблон продукта, новая страница `workforce`, `/industries`, `/industries/[slug]`.
7. `/calculator` и предвыбор калькулятора.
8. `/demo`, `app/api/demo-request/route.ts`, env-примеры.
9. SEO: metadata, sitemap, robots, JSON-LD.
10. `traefik/dynamic.yml`, `docs/ECOSYSTEM_URLS.md`, Dockerfile, workflow, smoke-скрипты (§2.2).
11. Аналитика (§17), самопроверка по §15, итоговый отчёт.

## 15. Критерии готовности

- Домен: все пункты §2.3.
- Языки: `/az`, `/ru`, `/en` отдают полноценные страницы без смешения языков; старые пути без префикса редиректят 308; hreflang и `x-default` в `<head>` и sitemap; скрипт паритета ключей `messages/*.json` проходит; EN без кириллицы и без «peyk/спутник».
- Меню: «Решения» (продукты) и «Отрасли» (с панелью состава бандла) в серверном HTML; ни одной копии шапки вне `components/site/*`; все ссылки без 404; Pilot-бейджи берутся из `site-catalog.ts`.
- Отрасли: 12 страниц, у каждой 5–6 карточек продуктов со ссылками, состав совпадает с §4.5 (или с правками владельца в конфиге); флага скрытия лизинга/НБКО нет.
- Калькулятор: кнопка выделена во всех местах §8; ссылка отрасли открывает `/calc` с предвыбранным набором и правильной ценой; логика калькулятора не изменена (`git diff` по запрещённым файлам пуст, кроме шапки и футера в `calc-page-view.tsx`).
- Демо: форма отправляет лид в CRM (проверка на тестовом `publicId`), антиспам работает (honeypot, время, rate limit), без env форма показывает запасные контакты и не падает; секрет не попадает в клиентский бандл (`grep` по `.next/static`).
- Контакты на `/demo#contacts`, в футере и JSON-LD; WhatsApp ссылка `wa.me/994773507070`; личного e-mail на сайте нет.
- Дизайн: `npm run lint:design-tokens` и `npm run lint:token-layers` без новых нарушений; новые цвета и радиусы не добавлены.
- Доступность: меню управляется с клавиатуры, Esc закрывает, `aria-expanded` корректен, мобильное меню с фокус-ловушкой, нет горизонтальной прокрутки на 360 px, `prefers-reduced-motion` учтён.
- SEO: серверный HTML главной содержит H1 и ссылки меню; уникальные title/description, canonical на apex; `/sitemap.xml` и `/robots.txt` отвечают 200.
- Нет новых зависимостей в `package.json`.

Итоговый отчёт Cursor: список созданных и изменённых файлов; как сделан каждый критерий; все `TODO(copy)`, `TODO(content)`, ⚑-допущения по составу бандлов и ключам калькулятора; где пришлось отступить от промта; открытые вопросы.

## 16. Внешние настройки (вне репозитория), чеклист для владельца

1. **DNS (DigitalOcean DNS, NS `ns1.digitalocean.com`)**: добавить запись `www` (A `164.92.151.56` или CNAME на `era-365.online`). Сейчас `www.era-365.online` не резолвится (NXDOMAIN), а в подписях писем уже указан `www.era-365.online`. Без записи Let's Encrypt не выдаст сертификат для `www`.
2. **Сервер (droplet 164.92.151.56)**: выложить новый `traefik/dynamic.yml` (Traefik следит за файлом, `watch: true`), пересобрать и перезапустить образ orchestrator с новыми build-args (`NEXT_PUBLIC_SITE_ORIGIN`, `NEXT_PUBLIC_APP_ORIGIN`). Проверить выпуск сертификата для `www` (`/letsencrypt/acme.json`, ACME HTTP-01 через порт 80, исключение `/.well-known/acme-challenge/` сохранено).
3. **Кэш/браузеры**: старый редирект был `308 Permanent`, браузеры могли его закэшировать; проверять в новом окне или после очистки кэша.
4. **CRM**: в CRM собственной организации создать подключение `form_generic`, записать `publicId` и `webhookSecret` в env (`ERA_DEMO_FORM_PUBLIC_ID`, `ERA_DEMO_FORM_WEBHOOK_SECRET`), убедиться, что `ERA_CRM_ORIGIN` доступен из контейнера orchestrator. В production `CRM_INTEGRATIONS_KEK` обязателен (иначе публичные хуки откажут).
5. Письма и подписи: после запуска проверить `https://era-365.online` и `https://www.era-365.online` в браузере и с мобильного.
6. Search Console: добавить домен `era-365.online`, отправить sitemap, проверить hreflang.

## 17. Аналитика
Сейчас аналитики нет. Вендор-независимая обёртка `lib/analytics/track.ts`: `track(event, params)`; если есть `window.dataLayer`, `dataLayer.push({ event, ...params })`; в development `console.debug`; на сервере ничего. Не подключай ни GTM, ни другие скрипты, не добавляй cookie. На CTA ставь `data-track="…"`.
События: `cta_demo_click`, `cta_calc_click`, `cta_trial_click`, `cta_login_click` с `location` (`header`, `mobile_menu`, `hero`, `megamenu_solutions`, `megamenu_industries`, `home_calc_block`, `industry_page`, `solution_page`, `footer`, `bottom_cta`, `calculator_landing`, `demo_page`); `nav_menu_open { menu }`, `nav_item_click { menu, item }`, `nav_bundle_preview { industry }`, `industry_view { slug }`, `solution_view { slug }`, `demo_form_submit { source }`, `demo_form_error { reason }`, `lang_switch { from, to }`.

## 18. Чего НЕ делать
- Не менять дизайн, цвета, шрифты, радиусы, фон `LandingPageShell`.
- Не трогать логику калькулятора и `packages/satellite-kit`.
- Не создавать новый API `demo-requests` в orchestrator.
- Не выдумывать клиентов, кейсы, награды, адрес, юрлицо, VÖEN.
- Не публиковать личный e-mail владельца.
- Не писать «спутник/сателлит/peyk» в публичных строках.
- Не менять `/industry/[vertical]`, авторизацию и поддомены сателлитов.
- Не делать git-коммиты.
