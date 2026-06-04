# 1_core — Data Hub consumer + де-хардкод плана счетов

**Волна:** `data-hub-consumer-wave-1` + `FEAT-FC-COA-001`  
**Документы:** [PRD §4.18](../PRD.md) · [TZ §28](../TZ.md) · [ADR era-data-hub](../../docs/adr/era-data-hub.md)  
**Зависимости:** нет (запускать **первым**).  
**Блокирует:** `2_core.md` (prepaid/инвойс), `3_core.md` (зеркальные проводки по ролям).

---

## 0. Цель и Definition of Done

После выполнения этого файла:

1. В `POSTING_ROLES` есть `PREPAID_ASSET` и `CHARTER_CAPITAL`; все три пресета JSON + seed `template_posting_roles` обновлены; `npm run validate:posting-roles` зелёный.
2. Все P1/P2 хардкоды из TZ §28.3 переведены на `PostingAccountResolver` (кроме документированных исключений P3).
3. `ledger.constants.ts` удалён; CI-гард-рейл не даёт добавлять новые литералы NAS в `apps/api/src/**`.
4. `DataHubClientService` расширен методами DH-004…010; потребители читают хаб при `ERA_DATA_HUB_ENABLED=true` с fallback на локальные источники.

---

## 1. Предусловия (composer выполняет до кода)

```powershell
cd "d:\My Projects\era-ecosystem\era-finance-core"
npm ci
```

**Локальные env (для ручной проверки хаба, опционально):**

| Переменная | Пример |
|------------|--------|
| `ERA_DATA_HUB_ENABLED` | `true` |
| `ERA_DATA_HUB_URL` | `http://127.0.0.1:4200` |
| `DATA_HUB_SERVICE_TOKEN` | совпадает с `era-data-hub` |

**Не трогать:** `era-finance-core/D:*npm-cache*` (артефакты Docker).

---

## 2. Часть A — Новые posting-роли

### A.1. Каталог ролей

**Файл:** `packages/database/prisma/lib/posting/posting-role.ts`

**Действие:** в массив `POSTING_ROLES` добавить **перед** закрывающей `]` (после `BUDGET_PAYROLL_EXPENSE`):

```typescript
  "PREPAID_ASSET",
  "CHARTER_CAPITAL",
```

### A.2. Маппинг по видам организации

| Роль | COMMERCIAL | BUDGET | NGO | Примечание |
|------|------------|--------|-----|------------|
| `PREPAID_ASSET` | `133` | `133` | `133` | РБП / расходы будущих периодов |
| `CHARTER_CAPITAL` | `821` | `501` | `301` | Взнос учредителя: комм. — `821` (Nizamnamə kapitalı в slim chart); бюджет — `501`; НГО — `301` (Fondlar) |

> **Важно:** не использовать `301` для COMMERCIAL `CHARTER_CAPITAL` — в `chart-of-accounts-commercial.json` код `301` = краткосрочные векселя, а `821` = уставный капитал. Banking/kassa сейчас сравнивают с `"301"` — в Части B перевести на resolver → `821` для коммерции.

**Файлы пресетов** (в каждый объект `roles` добавить две строки):

- `packages/database/prisma/catalog/national/posting-roles-commercial.json`
- `packages/database/prisma/catalog/national/posting-roles-budget.json`
- `packages/database/prisma/catalog/national/posting-roles-ngo.json`

Пример для commercial:

```json
    "PREPAID_ASSET": "133",
    "CHARTER_CAPITAL": "821",
```

### A.3. План счетов — добавить счёт 133 (commercial)

**Файл:** `packages/database/prisma/catalog/national/chart-of-accounts-commercial.json`

**Вставить** после блока `"code": "132"` (перед `"code": "201"`):

```json
    {
      "code": "133",
      "nameAz": "Gələcək dövrlərin xərcləri",
      "nameRu": "Расходы будущих периодов",
      "nameEn": "Prepaid expenses",
      "type": "ASSET",
      "parentCode": "100"
    },
```

**NGO:** в `chart-of-accounts-ngo.json` добавить аналогичный блок `133` (в секции активов, `parentCode` по структуре файла).

### A.4. Resolver shim

**Файл:** `apps/api/src/accounting/posting/posting-account-resolver.service.ts`

В объект `fallbacks` внутри `commercialPresetCode` добавить:

```typescript
      PREPAID_ASSET: "133",
      CHARTER_CAPITAL: "821",
```

### A.5. Тестовый mock

**Файл:** `apps/api/test/helpers/mock-posting-resolver.ts` (и `.js` если синхронизирован)

В `COMMERCIAL_BY_ROLE` добавить:

```typescript
  PREPAID_ASSET: "133",
  CHARTER_CAPITAL: "821",
```

### A.6. Сборка и валидация

```powershell
cd "d:\My Projects\era-ecosystem\era-finance-core"
npm run build -w @erafinance/database
npm run validate:posting-roles
npm test -w @erafinance/database -- posting-seed.spec
```

При необходимости обновить сиды:

```powershell
cd packages/database
npx prisma db seed
```

(или `seedNationalChart` через существующий national seed).

---

## 3. Часть B — Де-хардкод (P1 → P2)

**Общий паттерн для сервисов:**

1. Инжектировать `PostingAccountResolver` в constructor (если ещё нет).
2. Заменить литерал на `await this.posting.resolveAccountCode(organizationId, "ROLE_NAME", tx?)`.
3. Для sync-контекстов без `orgId` — только там, где уже есть org в scope.

### B.1. P1 — Prepaid

**Файлы:**
- `apps/api/src/prepaid/prepaid-expenses.service.ts`
- `apps/api/src/prepaid/dto/create-prepaid-expense.dto.ts`
- `apps/api/src/prepaid/prepaid.module.ts` — импорт `AccountingModule` / posting уже через `AccountingService`; добавить `PostingAccountResolver` если модуль не экспортирует.

**`prepaid-expenses.service.ts` (~строки 79–81):**

```typescript
// BEFORE
const expenseCode = dto.expenseAccountCode?.trim() || "731";
const prepaidCode = dto.prepaidAccountCode?.trim() || "133";

// AFTER (внутри $transaction, после открытия tx)
const expenseCode =
  dto.expenseAccountCode?.trim() ||
  (await this.posting.resolveAccountCode(organizationId, "MISC_OPERATING_EXPENSE", tx));
const prepaidCode =
  dto.prepaidAccountCode?.trim() ||
  (await this.posting.resolveAccountCode(organizationId, "PREPAID_ASSET", tx));
```

**DTO:** убрать `@ApiProperty({ default: "731" })` / `"133"` или заменить описанием «если пусто — из posting role».

**`postMonth`:** проводки уже используют `prepaid.expenseAccountCode` / `prepaidAccountCode` с entity — после create дефолты будут из resolver.

### B.2. P1 — Invoices

**Файлы:**
- `apps/api/src/invoices/invoices.service.ts` (~355, ~730)
- `apps/api/src/invoices/dto/create-invoice.dto.ts` (~61–64)

**create:** дефолт `debitAccountCode`:

```typescript
const defaultCash = await this.posting.resolveAccountCode(organizationId, "CASH_AZN");
// использовать defaultCash вместо "101"
```

**allocatePaymentAcrossInvoices:** `221` → `await this.posting.resolveAccountCode(organizationId, "MAIN_BANK")`.

**DTO:** убрать enum `["101", "221"]`; сделать `string` + валидация на сервере (полная динамика — в `2_core` UX-008).

### B.3. P1 — PSA + Satellite

**`apps/api/src/psa/psa.service.ts`:** `debitAccountCode: "101"` → resolve `CASH_AZN`.

**`apps/api/src/integration/satellite-event-dispatch.service.ts`:**
- `createDraftInvoice` (~226): `debitAccountCode: "101"` → `await this.posting.resolveAccountCode(organizationId, "CASH_AZN")`.
- `handleHotelInvoiceIssued` (~265): то же.

### B.4. P2 — Manufacturing overhead

**`apps/api/src/manufacturing/manufacturing-overhead.service.ts`:**

Дефолты пула (~111–112, ~231):

```typescript
const creditDefault = await this.posting.resolveAccountCode(organizationId, "MANUFACTURING_OVERHEAD_CREDIT");
const debitDefault = await this.posting.resolveAccountCode(organizationId, "FINISHED_GOODS");
```

**DTO:** `create-overhead-pool.dto.ts`, `allocate-overhead-batch.dto.ts` — убрать swagger default `741`/`204`.

### B.5. P2 — Inventory

**`apps/api/src/inventory/inventory.service.ts` (~2558, ~2969):**

Паттерн из `inventory-audit.service.ts:456–463`:

```typescript
const [finishedGoodsCode, inventoryGoodsCode] = await Promise.all([
  this.posting.resolveAccountCode(organizationId, "FINISHED_GOODS"),
  this.posting.resolveAccountCode(organizationId, "INVENTORY_GOODS"),
]);
// сравнивать dto.warehouse.inventoryAccountCode с finishedGoodsCode, не с "204"
```

**DTO** (`adjust-stock.dto.ts`, `write-off-stock-document.dto.ts`, `surplus-stock-document.dto.ts`): заменить enum литералов на документацию «код склада из настроек warehouse» или константы-роли на API (опционально отложить в 2_core).

### B.6. P2 — Migration opening balances

**`apps/api/src/migration/opening-balances.service.ts`:**

- Строки с `201`/`204` → resolve `INVENTORY_GOODS` / `FINISHED_GOODS`.
- `000` — оставить как **системный контра**; добавить комментарий `// SYSTEM_OPENING_CONTRA — not a PostingRole`.

### B.7. P2 — Organizations / Accounts / Accounting

| Файл | Было | Стало |
|------|------|-------|
| `organizations/organization-settings.service.ts` ~121 | `"221"` | `MAIN_BANK` |
| `accounts/accounts.service.ts` ~378,385 | `"211"`, `"601"` | `TRADE_RECEIVABLE`, `SALES_REVENUE` |
| `accounts/accounts.service.ts` ~645,659 | `"221"` parent check | `await resolve MAIN_BANK` для parent |
| `accounting/bank-subaccount.service.ts` ~10 | `BANK_SUBACCOUNT_PARENT_CODE = "221"` | async init from resolver или константа из `MAIN_BANK` при старте модуля |
| `accounting/accounting.service.ts` ~35–41 NAS fallback `241` | | `VAT_INPUT` через resolver при создании fallback account |

### B.8. P2 — Banking / Kassa (CHARTER_CAPITAL)

**`apps/api/src/banking/banking.service.ts`:**

Найти проверки `offset === "301"` или `accountCode === "301"`. Заменить на:

```typescript
const charterCode = await this.posting.resolveAccountCode(organizationId, "CHARTER_CAPITAL");
if (offset === charterCode) { ... }
```

Префиксы `101`, `221`–`224` в `isBankLedgerAccountCode` — **оставить** (валидатор семейств, TZ §28.3 P3).

**`apps/api/src/kassa/cash-order.service.ts`:** аналогично для `301` и фильтра кассы `101` (префикс оставить).

### B.9. P3 — Не менять

- `reports/financial-report.service.ts`, `reporting/reporting.service.ts` — агрегация по префиксам.
- `common/cash-account-code.util.ts` — валидатор 101/102 и анти-касса 211/531/538.
- `scripts/local-mock-seed.ts` — dev only.

### B.10. Удалить legacy

**Удалить файл:** `apps/api/src/ledger.constants.ts`

**Проверить импорты:**

```powershell
rg "ledger\.constants" era-finance-core/apps/api/src
```

Если есть — заменить на `PostingAccountResolver` или удалить неиспользуемые импорты.

---

## 4. Часть C — CI гард-рейл

**Создать:** `packages/database/prisma/scripts/validate-no-nas-literals.ts`

**Логика:**

1. Сканировать `era-finance-core/apps/api/src/**/*.ts`, исключить:
   - `**/*.spec.ts`
   - `accounting/posting/**`
   - `scripts/**`
   - `admin/i18n-default-catalog-data.json` (не ts)
2. Regex для подозрительных литералов: `accountCode:\s*['"]\d{3}`, `['"]\d{3}(\.\d+)?['"]` в контексте debit/credit/offset.
3. Whitelist файлов: `common/cash-account-code.util.ts`, `banking/banking.service.ts` (только функции prefix), `reporting/**`, `reports/**`.
4. При match — `process.exit(1)` с путём и строкой.

**Добавить в** `era-finance-core/package.json`:

```json
"validate:no-nas-literals": "tsx packages/database/prisma/scripts/validate-no-nas-literals.ts"
```

**Добавить шаг в** `.github/workflows/ci.yml` в job `finance` после `validate:posting-roles`:

```yaml
      - name: Validate no NAS literals in API
        working-directory: era-finance-core
        run: npm run validate:no-nas-literals
```

---

## 5. Часть D — Расширение DataHubClientService

**Файл:** `apps/api/src/data-hub/data-hub-client.service.ts`

**Добавить типы и методы** (все через существующий `getJson<T>`):

| Метод | Path |
|-------|------|
| `getBanks()` | `/banks` |
| `getBankBranches(code)` | `/banks/branches/${code}` |
| `validateIban(iban)` | `/iban/validate?iban=` |
| `getChartOfAccounts(profile)` | `/chart-of-accounts?profile=` |
| `getTaxRates(type, date?)` | `/tax-rates?type=&date=` |
| `getGeoCountries()` | `/geo/countries` |
| `getGeoCities(country?)` | `/geo/cities?country=` |
| `getUom()` | `/uom` |
| `addBusinessDays(date, n, country?)` | `/calendar/${country}/add-business-days?date=&n=` |

Контракт ответов — `era-data-hub/TZ.md`.

---

## 6. Часть E — Подключение потребителей

### E.1. HrCalendarService (DH-003)

**Создать:** `apps/api/src/hr/hr-calendar.service.ts`

```typescript
@Injectable()
export class HrCalendarService {
  constructor(private readonly dataHub: DataHubClientService) {}
  private yearCache = new Map<string, Map<string, boolean>>();

  async isWorkingDay(isoDate: string): Promise<boolean> {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.isWorkingDay(isoDate, "az");
      if (remote !== null) return remote;
    }
    const [y, m, d] = isoDate.split("-").map(Number);
    return isAzWorkingDay(y, m - 1, d);
  }
}
```

**Зарегистрировать** в `hr.module.ts`, инжектировать в:
- `timesheet.service.ts` — заменить прямые вызовы `isAzWorkingDay`
- `payroll-month-calendar.ts` — сделать `countAzWorkingDaysInMonth` async или pre-fetch

**После стабилизации:** удалить `hr/calendar/az-2026.ts` (отдельный commit в конце волны).

### E.2. VÖEN chain (DH-006)

**`global-company-directory.service.ts` — `findByTaxId`:**

```typescript
if (this.dataHub.isEnabled()) {
  const remote = await this.dataHub.getCompanyByVoen(id);
  if (remote) return mapHubToDirectoryShape(remote);
}
return this.prisma.globalCompanyDirectory.findUnique(...);
```

**`counterparties.service.ts` — `lookupGlobalByVoen`:** в начале цепочки — hub, затем cache, затем e-taxes.

### E.3. Chart onboarding (DH-010, D-DH-1)

**Файл:** `packages/database/prisma/lib/chart/chart-seed.ts`

В `syncChartForOrganization` / `loadChartJson`:

1. Если передан `DataHubClient` и enabled — `getChartOfAccounts(kind.toLowerCase())`.
2. Маппинг ответа хаба в формат `ChartJson` (accounts array).
3. Fallback: существующий `readFile` catalog JSON.

**Проброс:** опционально фабрика в `OrganizationsService.provisionChartOfAccountsFromTemplate` — на первом этапе достаточно read-through в seed при следующем provision (документировать).

### E.4. BankDirectoryService (DH-004/005)

**Создать:** `apps/api/src/banking/bank-directory.service.ts`

- `listBanks()` — hub → `prisma.bankGlossary.findMany`
- `getBranch(code)` — hub → `prisma.bankBranch.findUnique`

**Создать контроллер** или расширить `system-catalog.controller.ts`:

```
GET /api/system/banks
GET /api/system/banks/:bankCode/branches
```

**`iban-validation.service.ts`:** перед `validateAzIban` — `dataHub.validateIban`.

### E.5. System catalog (DH-007/008/009)

**`apps/api/src/system/system-catalog.controller.ts`:**

| Endpoint | Метод хаба | Fallback |
|----------|------------|----------|
| `GET invoice-vat-rates` | `getTaxRates('VAT', date)` | `prisma.taxRate` |
| `GET units-of-measure` | `getUom()` | `prisma.unitOfMeasure` |
| (новый) `GET geo/countries` | `getGeoCountries()` | prisma/static |

---

## 7. Команды финальной проверки

```powershell
cd "d:\My Projects\era-ecosystem\era-finance-core"
npm run build -w @erafinance/database
npm run validate:posting-roles
npm run validate:no-nas-literals
npm run build -w @erafinance/api
npm test -w @erafinance/api -- --testPathPattern="posting|prepaid|customs"
```

**Ручной smoke (опционально):**

1. `ERA_DATA_HUB_ENABLED=false` — создание prepaid, инвойса, payroll timesheet работает как раньше.
2. `ERA_DATA_HUB_ENABLED=true` + поднятый `era-data-hub` — курс/тариф/календарь из хаба (логи `DataHubClientService` без WARN).

---

## 8. Чек-лист приёмки

- [ ] `PREPAID_ASSET`, `CHARTER_CAPITAL` в `POSTING_ROLES` и во всех 3 JSON пресетах
- [ ] Счёт `133` в commercial (+ ngo) chart JSON; `validate:posting-roles` OK
- [ ] P1 файлы (prepaid, invoices, psa, satellite) без литералов 101/221/731/133
- [ ] P2 файлы (manufacturing, inventory, migration, org settings, accounts, banking, kassa) на resolver
- [ ] `ledger.constants.ts` удалён, нет импортов
- [ ] `validate:no-nas-literals` в package.json и CI
- [ ] `DataHubClientService` — 8 новых методов
- [ ] `HrCalendarService`, `BankDirectoryService`, hub в directory/counterparty/chart/iban/system-catalog
- [ ] PRD/TZ статусы не менять автоматически — только по решению PO после QA

---

## 9. Что НЕ входит в 1_core (см. другие файлы)

- UI (модалки, таблицы) → `2_core.md`
- `NetworkDocument` → `3_core.md`
- Orchestrator citizens API, e-Qaimə → `4_orchestrator.md`
