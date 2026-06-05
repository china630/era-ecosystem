# 2_core — UX и онбординг (FEAT-FC-UX-001…009)

**Волна:** `finance-core-ux-wave-1`  
**Документы:** [PRD §4.17](../PRD.md) · [TZ §27](../TZ.md)  
**Зависимости:** **`1_core.md` обязателен** (posting-роли `PREPAID_ASSET`, де-хардкод счетов, Data Hub VÖEN chain).  
**Ждёт:** `4_orchestrator.md` для полноценного FIN-кода (UX-007 можно сделать UI-заглушку).  
**Статус:** ✅ выполнено — чек-лист приёмки отмечен 2026-06-05.

---

## 0. Definition of Done

- Шапка выровнена со спутниками (tier bar, locale, org, notifications, profile).
- При 2+ компаниях — **блокирующая модалка** выбора org (не закрывается, переживает F5).
- `/banking` и `/banking/cash` — full width.
- `/treasury/cash-flow` — фильтры в одной строке.
- Prepaid — таблица + модалка создания + поле `description`.
- Контрагент — узкая модалка, VÖEN-first, director/phones, пассивные поля до Yoxla.
- Инвойс — динамические денежные счета, банковский счёт, валюта.
- Закупки — «Оплатить» в реестре и в кредиторке (531).

---

## FEAT-FC-UX-001 — Шапка (PARTIAL → DONE)

### Текущее состояние

| Компонент | Путь |
|-----------|------|
| Header | `apps/web/components/layout/Header.tsx` (`MainHeader` → `EraAppHeader`) |
| Tier bar | `apps/web/components/header-subscription-strip.tsx` → `HeaderTierUsageBar` |
| Org switcher | `apps/web/components/layout/header-organization-switcher.tsx` |
| Locale | `apps/web/app/language-switcher.tsx` → `LocaleToggle` |
| Notifications | `apps/web/components/notifications/in-app-notification-bell.tsx` |
| Profile | `@era/satellite-kit/ui` `HeaderProfileMenu` |
| Mount | `apps/web/app/app-shell.tsx` |

### Шаги

1. **Проверить** на `localhost:3100` при логине: tier strip, locale, org dropdown, bell, avatar — все видны.
2. **Опционально:** заменить `InAppNotificationBell` на `SatelliteNotificationBell` из kit — только если API совместим; иначе оставить и добавить комментарий `// Finance-specific notification adapter`.
3. **Документировать** в `Header.tsx` JSDoc: `HeaderSubscriptionStrip` = адаптер `HeaderTierUsageBar` для finance snapshot.

**Приёмка:** визуально совпадает с hotel/satellite header slots; нет регрессии guest mode (login/register без org strip).

---

## FEAT-FC-UX-002 — Блокирующий выбор компании

### Требование (D из PRD)

- При `user` с доступом к **2+** организациям и **без** `organizationId` — модалка **обязательна**.
- **Всегда** требовать явный выбор при 2+ (не авто-последняя).
- Модалка: нет закрытия по Escape/overlay/крестику.
- F5 → снова модалка, пока org не выбрана.

### Создать компонент

**Файл:** `apps/web/components/companies/company-select-blocking-modal.tsx`

```tsx
"use client";
// Props: open: boolean (true when token && user && !user.organizationId && memberships.length >= 2)
// Render Dialog from @erafinance/ui OR SalesModalShell with:
//   - no onClose dismiss
//   - onOpenChange only allows open=true
// List organizations from useAuth().memberships or dedicated API
// On pick: switchOrganization(orgId) then router.refresh() or router.push("/")
```

**Использовать** `Dialog` с `modal={true}` и заблокировать:

```tsx
<Dialog open={mustSelect} onOpenChange={() => { /* ignore false */ }}>
```

или `SalesModalShell` без кнопки X.

### Интеграция в AppShell

**Файл:** `apps/web/app/app-shell.tsx`

После существующего `useEffect` редиректа (~259–266):

```tsx
const mustBlockCompanySelect =
  ready &&
  token &&
  user &&
  !user.organizationId &&
  (user.memberships?.length ?? 0) >= 2;

// render <CompanySelectBlockingModal open={mustBlockCompanySelect} />
```

**Уточнить** в `auth-context.tsx`: есть ли `memberships` / список org. Если нет — `GET /api/auth/me` должен возвращать `organizations: { id, name }[]`.

### Backup redirect

Оставить `router.replace("/companies")` для 0–1 org или fallback; при 2+ показывать модалку **поверх** shell (не только redirect).

### Приёмка

- User с 2 org, `organizationId=null` → модалка, клик вне не закрывает.
- F5 → модалка снова.
- После выбора → главная, header показывает org.

---

## FEAT-FC-UX-003 / 004 — Full width banking

### Файлы

| Route | Файл |
|-------|------|
| `/banking` | `apps/web/app/banking/page.tsx` |
| `/banking/cash` | `apps/web/app/(app)/banking/cash/page.tsx` |

### Изменение

**BEFORE:** `max-w-6xl mx-auto` или `max-w-7xl mx-auto` на корневом div/section.

**AFTER:** как prepaid:

```tsx
<div className="w-full max-w-none space-y-10">
```

Shell `main.app-shell-main` уже `w-full` (`globals.css`).

### Приёмка

Таблицы банка используют всю ширину `app-shell-main`; горизонтальный скролл через `DATA_TABLE_VIEWPORT_CLASS` сохранён.

---

## FEAT-FC-UX-005 — Cash-flow фильтр в одну строку

**Файл:** `apps/web/app/treasury/cash-flow/page.tsx`

### Целевой layout

```
PageHeader title="..."
  actions={
    <div className="flex flex-wrap items-center gap-2 h-8">
      <span>{horizonLabel}</span>
      <Select horizon 14|30|60|90 />
      {/* optional: unit "gün" when API supports */}
      <ListPaginationFooter compact for day page size />
    </div>
  }
```

### Шаги

1. Перенести horizon `Select` из `subtitle`/`leading` в `PageHeader` prop `actions`.
2. Subtitle (пояснение liquidity) — отдельный `<p className="text-sm text-muted-foreground">` под header, не в filter row.
3. Заменить кастомную пагинацию на `ListPaginationFooter` (паттерн `sales/invoices/page.tsx`).

### Приёмка

На desktop фильтр — одна горизонтальная полоса; на mobile `flex-wrap`.

---

## FEAT-FC-UX-006 — Prepaid: таблица + модалка + description

### Backend

**Prisma** `packages/database/prisma/schema.prisma` — модель `PrepaidExpense`:

```prisma
  description String? @map("description")
```

**Миграция:**

```powershell
cd era-finance-core/packages/database
npx prisma migrate dev --name prepaid_expense_description
```

**DTO** `apps/api/src/prepaid/dto/create-prepaid-expense.dto.ts`:

```typescript
@IsOptional()
@IsString()
@MaxLength(500)
description?: string;
```

**Service** `create`: сохранить `description: dto.description?.trim() || null`.

### Frontend

**Создать:** `apps/web/components/finance/modals/CreatePrepaidExpenseModal.tsx`

- `SalesModalShell` + `SalesModalFooter`
- Поля: `description`, `totalAmount`, `startDate`, `endDate`, optional counterparty, optional account codes (advanced)
- POST `/api/prepaid-expenses`

**Переписать:** `apps/web/app/finance/prepaid-expenses/page.tsx`

- Удалить inline create `<section>`.
- Кнопка «Yarat» → `setModalOpen(true)`.
- Список → `<table className={DATA_TABLE_CLASS}>` колонки: description, period, total, currency, status, actions (post month).
- `ListPaginationFooter` если >25 строк.

**Импорты из** `lib/design-system.ts`: `DATA_TABLE_*`, `PRIMARY_BUTTON_CLASS`.

### Приёмка

- Создание через модалку; список — таблица ERA.
- `description` в API и UI.
- Счета по умолчанию из posting roles (после 1_core).

---

## FEAT-FC-UX-007 — Модалка контрагента

### Backend

**Prisma `Counterparty`** — добавить (если нет):

```prisma
  directorNameCipher String? @map("director_name_cipher")
  phonesJson         Json?   @default("[]") @map("phones_json")  // string[] E.164
  finCodeCipher      String? @map("fin_code_cipher")
  finCodeBlindIndex  String? @map("fin_code_blind_index")
```

Миграция `counterparty_director_phones_fin`.

**DTO** create/update — `directorName`, `phones: string[]`, `finCode?` (для `CounterpartyKind.INDIVIDUAL`).

**Tax API (сервер):** новый `GET /api/tax/vat-payer-info?voen=` в `TaxpayerIntegrationService` — парсинг search-vat-payer (TZ §27.6). Ветка физлица в `lookupTaxpayerByVoen`.

### Frontend `CreateCounterpartyModal.tsx`

**Путь:** `apps/web/components/sales/modals/CreateCounterpartyModal.tsx`

| Изменение | Деталь |
|-----------|--------|
| Ширина | `maxWidthClass="max-w-3xl"` → **`max-w-[calc(42rem*0.7)]`** или `max-w-2xl` (~30% уже) |
| VÖEN first | Первая строка: VÖEN + кнопка Yoxla; **все остальные поля `disabled={!voenVerified}`** |
| State | `voenVerified` true после успешного checkVoen |
| Layout | Checkbox ƏDV + legalForm — **одна строка** `grid grid-cols-2` |
| Новые поля | `directorName`, `phones: string[]` с кнопкой «+» |
| FIN | Показать `finCode` input если role/kind физлицо; lookup — **заглушка** до 4_orchestrator |
| Flags | `manualCheckTax`, `manualCheckInternal` badges |

**Цепочка VÖEN (после 1_core):** directory (hub-first) → global → tax → tax vat-payer → физлицо fallback.

### Counterparty bank accounts modal

**Уже есть:** поиск `CounterpartyBankAccountsModal` в `apps/web`. Подключить action из таблицы `crm/counterparties/page.tsx` если не подключено.

### Приёмка

- До Yoxla поля disabled; после — editable.
- Director + dynamic phones сохраняются.
- Модалка визуально уже на ~30%.

---

## FEAT-FC-UX-008 — Инвойс: Ödənişdə Dt динамический

### Backend — новый endpoint

**Создать** `apps/api/src/system/money-accounts.controller.ts` (или расширить system module):

```
GET /api/system/money-accounts?purpose=incoming
```

**Response:**

```json
{
  "options": [
    { "code": "101.01", "label": "Kassa AZN", "kind": "CASH", "currency": "AZN" },
    { "code": "221.01", "label": "Bank AZN", "kind": "BANK", "currency": "AZN", "requiresBankAccountId": true }
  ]
}
```

**Логика:**

1. `PostingAccountResolver` → коды `CASH_AZN`, `CASH_FOREIGN`, `MAIN_BANK` для org.
2. Список NAS accounts org с префиксами 101*, 102*, 221* (и budget/ngo аналоги из resolver).
3. Для BANK — join `OrganizationBankAccount` active list.

**Invoice create DTO:** добавить optional `bankAccountId?: string`.

**Validation** в `invoices.service.ts`: если debit — bank, `bankAccountId` required; currency must match bank account currency; cash → force AZN.

### Frontend `CreateInvoiceModal.tsx`

1. `useEffect` load `/api/system/money-accounts?purpose=incoming`.
2. Replace hardcoded Select 101/221 with dynamic options.
3. When `kind===BANK` show second Select `bankAccountId` from `/api/banking/bank-accounts`.
4. Bind `currency` Select: disabled when inferred from account.

### Приёмка

- Commercial org: 101.01 / 221*, не только литералы 101/221.
- Budget/NGO org: свои коды из resolver.
- Валютный банк-счёт → currency auto.

---

## FEAT-FC-UX-009 — Закупки: оплата в двух местах

### Продуктовое решение (TZ §27.8)

Модалка «Yeni alış fakturası» — **без** счёта оплаты. Оплата — отдельное действие.

### Backend — единый платёж

**Создать или расширить** `apps/api/src/purchases/purchase-payment.service.ts`:

```typescript
payPurchaseInvoice(organizationId, {
  purchaseInvoiceId,
  amount,
  paymentDate,
  debitAccountCode?,  // resolved CASH_AZN / MAIN_BANK
  bankAccountId?,
})
```

**Проводка:** `Dr SUPPLIER_PAYABLE / Cr CASH_AZN|MAIN_BANK` через `PostingJournalBuilder` schema или manual lines + resolver.

**Endpoints:**

```
POST /api/purchases/invoices/:id/pay
POST /api/payables/suppliers/:counterpartyId/pay  // allocation FIFO
```

### Frontend

1. **`apps/web/app/purchases/page.tsx`** — в row actions добавить «Ödəniş et» → modal `PayPurchaseModal` (amount, date, money account, bank account).
2. **Кредиторка** — найти или создать страницу payables (531). Поиск: `rg "531|payables|supplier" apps/web/app`. Если нет — создать `apps/web/app/finance/payables/suppliers/page.tsx` с таблицей долгов по контрагенту и той же `PayPurchaseModal`.

### Приёмка

- Оплата из реестра закупок и из кредиторки вызывает **один** API.
- Частичная оплата уменьшает долг 531.

---

## Команды проверки

```powershell
cd "d:\My Projects\era-ecosystem\era-finance-core"
npx prisma migrate dev
npm run build -w @erafinance/web
npm run build -w @erafinance/api
```

**Manual QA:** `docs/manual-qa/` — дописать сценарии UX-002, 006, 008.

---

## Чек-лист приёмки 2_core

- [x] UX-001 header verified
- [x] UX-002 blocking modal + F5
- [x] UX-003/004 banking full width
- [x] UX-005 cash-flow filter row
- [x] UX-006 prepaid table + modal + description migration
- [x] UX-007 counterparty modal UX + backend fields + vat-payer API
- [x] UX-008 money-accounts API + invoice modal
- [x] UX-009 pay purchase from two entry points
- [x] Зависимость 1_core: нет литералов 101/221/133/731 в затронутых API paths

---

## Не входит в 2_core

- `NetworkDocument` → `3_core.md`
- FIN lookup production → `4_orchestrator.md`
