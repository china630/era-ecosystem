# ADR: Asia/Baku operational clock

**Status:** Accepted  
**Date:** 2026-09-22  
**Implementation:** Waves **0–5 landed** — kit, hotel/clinic/F&B ops day, orch/finance billing, UI labels, leftover satellites, lint lock (`lint:baku-clock`).  
**Related:** [era-common-laws.mdc](../../.cursor/rules/era-common-laws.mdc) · clinic `baku-day` · hotel `hotel-calendar.ts`

## Context

Product calendars, shifts, night audit, billing periods, and user-visible timestamps must follow **Asia/Baku** (UTC+4 year-round, no DST). Storage remains UTC instants.

Several apps mixed three clocks:

1. UTC instant (`new Date()`, Prisma `DateTime`) — correct for storage  
2. UTC calendar day (`toISOString().slice(0, 10)`) — wrong for “today” between 00:00–04:00 Baku  
3. Host / browser local (`toLocaleString()`, `setHours(0,0,0,0)`) — wrong when Node/CI/browser is not Baku  

Setting `TZ=Asia/Baku` on containers does **not** fix (2): `toISOString()` is always UTC.

## Decision

### Storage vs display

| Layer | Rule |
|-------|------|
| DB `DateTime` / `timestamptz` | UTC instant |
| User-facing labels | `Asia/Baku` via kit helpers |
| Operational “today” / day bounds | Baku calendar via kit (`todayBakuYmd`, `bakuDayBounds`) |
| `@db.Date` civil day | UTC midnight of that **civil** YMD (not host wall-clock) |

### Shared API

Import **`@era/satellite-kit/time`** (subpath — not the main kit barrel; keeps client components free of Node-only kit deps).

Canonical helpers: `ERA_TIME_ZONE` (`BAKU_TZ` alias), `bakuDateKey`, `todayBakuYmd`, `bakuDayBounds`, `bakuCivilUtcDate` (`@db.Date` = UTC midnight of civil YMD), `parseBakuDateTime`, display labels, plus `billingPeriodKeyBaku` / `bakuMonthBounds` for later billing migration.

Hotel stay policy (check-in 14:00 / check-out 12:00 Baku) stays in `era-hotel-pms/src/lib/hotel-calendar.ts`; `hotelDateKey` delegates to kit.

### Forbidden (platform-wide)

1. **`TZ=Asia/Baku` as the platform fix** — does not fix UTC day slices; breaks CI/tests that assume UTC.  
2. **`new Date().toISOString().slice(0, 10)` as “today”** — use `todayBakuYmd()`.  
3. **`toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` without `timeZone`** — use kit labels or explicit `timeZone: "Asia/Baku"`.  
4. **`setHours(0,0,0,0)` as operational day start** — use `bakuDayBounds` / `parseBakuDateTime`.  

Do **not** rewrite audit `createdAt` ISO timestamps; those are instants, not calendar days.

### Anti-patterns vs OK

| Bad | OK |
|-----|-----|
| UTC slice as today | `todayBakuYmd()` |
| Browser `toLocaleString()` | `bakuDateTimeLabel` / `Intl` + `Asia/Baku` |
| Host midnight for day window | `bakuDayBounds(ymd)` |
| Serializing `@db.Date` via local `setHours` | `bakuCivilUtcDate(ymd)` |

## Consequences

- New calendar / “today” / wall-clock code goes through kit.  
- Apps may keep thin re-exports (`era-clinic/src/lib/baku-day.ts`) for local import paths.  
- Enforcement: `lint:baku-clock` (empty baseline, CI packages job `--strict`).  
- Do not set container `TZ` to Baku solely for this ADR.

## Implementation wave 1 (hotel / clinic / F&B)

Operational “today” and day windows no longer use UTC `toISOString().slice(0,10)` or host `setHours(0,0,0,0)`:

| Product | Pattern |
|---------|---------|
| Hotel | `hotelDateKey()` / `todayBakuYmd` for FO/cash/HK/NA defaults; `bakuDayBounds` for night-audit arrival windows; business-date fallback `bakuCivilUtcDate(todayBakuYmd())`; card times via `bakuTimeLabel` |
| Clinic | Calendar/queue/executive/slots use `todayBakuYmd` + `bakuDayBounds`; EOD/slots via `parseBakuDateTime` |
| F&B | `DailyMenuEntry.boardDate` = `bakuCivilUtcDate(todayBakuYmd())`; reservations filter via `bakuDayBounds` |

Evidence: `era-hotel-pms/__tests__/business-date-baku.spec.ts`, `era-clinic/__tests__/baku-day-boundaries.spec.ts`.

### Thin-spot pass (post wave 1)

Follow-up cleaned leftovers that used the same antipatterns outside the original file list:

- Hotel: NA side screens, transfers/channel/group/BAR/L&F/report defaults; `setHours(0)` night walks; report period presets (`period.ts`) + HK roster week; contract `eachNight`; share `overlapsNight`; channel auto-push horizon.
- Clinic: scheduling `getHours()` → `bakuHourMinute`; cashier/cron UTC-midnight filters → `bakuDayBounds`; sanatorium + appointment create wall times via `parseBakuDateTime` / `bakuTimeLabel`; diagnosis report + history lookback via `addBakuDays`.
- Kit: `bakuHourMinute`, `addBakuDays`.

## Implementation wave 2 (orch / finance / data-hub)

Billing period keys and trial end-of-month live in kit; orch/finance `baku-billing.util` and trial date helpers re-export `@era/satellite-kit/time`.

| Product | Pattern |
|---------|---------|
| Orchestrator | Workforce hireDate / order effectiveDate / absence month / roster year → `todayBakuYmd` / `billingPeriodKeyBaku` / `bakuYmd`; timesheet `isoTodayBaku` → kit; catalog FX `rateDate` fallback → `todayBakuYmd` |
| Finance | Kassa/banking TB `today` + `yearStart` → `todayBakuYmd` / `bakuYearStartYmd`; `INV-YYYY` → `bakuCalendarYear`; web form date defaults → kit; `data-hub-client.isoDateBaku` → `bakuDateKey` |
| Data-hub | Registry meta `asOf` + FX default day → `todayBakuYmd` / kit `bakuDateKey` (dep on `@era/satellite-kit/time` only) |

Kit additions: `bakuCalendarYear`, `bakuYearStartYmd`, `bakuEndOfDayUtc`, `computeTrialExpiresEndOfMonthBaku`, `computeTrialExpiresAtBaku`.

Evidence: orch `trial-date.util.spec.ts` / `trial-package.util.spec.ts`; finance `trial-package.util.spec.ts`; kit `baku.test.ts` trial case. `@Cron(..., { timeZone: "Asia/Baku" })` unchanged.

### Thin-spot pass (post wave 2)

- Orch: timesheet export year/month defaults; monthly billing invoice `dateOnly`; `endOfUtcMonth` / `proRataFractionUtc` / tier upgrade periodEnd → Baku month bounds.
- Finance: billing-meter intraday period bounds; same `endOfUtcMonth` / pro-rata / periodEnd; PR-YYYY numbering; AP aging / pay / network / BS / HR timesheet / tax-year form defaults.

## Implementation wave 3 (UI labels)

Display of stored UTC instants on ops/admin UI always uses Asia/Baku via `@era/satellite-kit/time`. Browser/host TZ is ignored. Number `n.toLocaleString` unchanged. Lint lock deferred to wave 5.

| Helper | Format | Replaces |
|--------|--------|----------|
| `bakuDateTimeDisplay` | `DD.MM.YYYY HH:mm` (24h) | `Date#toLocaleString()` |
| `bakuDateDisplay` | `DD.MM.YYYY` | `Date#toLocaleDateString()` |
| `bakuTimeLabel` | `HH:mm` | `Date#toLocaleTimeString()` |
| `bakuDateTimeLabel` | compact ops | already existed |

Scope: clinic ops/admin UI; hotel FO/cash/NA/banquets/tours/transfers/contracts/audit; orch attendance/security audit/notifications/person-access; finance audit/activity/sync timestamps; F&B shift/menu; CRM leads/visits/inbox; bank admin audit; logistics fleet/trips; auto-service appointments.

Leave alone: `toLocale*` / `Intl` already with `timeZone: "Asia/Baku"` or `timeZone: "UTC"` for civil YYYY-MM-DD keys; date-only `@db.Date` string slices.

UAT: clinic resources/nurse, hotel front-cash, orch attendance — displayed wall time equals Baku even when browser TZ is UTC.

### Thin-spot pass (post wave 3)

- **P0:** F&B calendar `startAt`/`endAt` and hotel HK `neededByAt` used UTC `.slice(11,16)` → `bakuTimeLabel`.
- **Hotel:** FO reservation-times / room-changes / laundry / spa / airport transfers / reservation-card history / guest surveys / city-ledger fallback — ISO `.slice(0,16)` → `bakuDateTimeDisplay` / `bakuDateDisplay`; laundry day filter → `bakuDateKey`.
- **Finance:** trade-credit, audit-hub, inventory audits/rowDate fallbacks, verify portal, banking/manufacturing/network-inbox/fixed-assets, trial banner + header strip, buyer grants, EMAS S2S — UTC slice / browser-local → kit.
- **Orch:** satellite settings / subscription until / early-access / security / Channex / staff-schedule createdAt.
- **Bank:** liquidity-gap, AML rules, account statement createdAt, FATCA updatedAt.

Left alone: civil `@db.Date` / `documentDate` / maturity slices; number `toLocaleString`; print/`Intl` already on Asia/Baku.

## Implementation wave 4 (remaining satellites + mop-up)

Industry leftovers and post–wave-1/2 mop-up of “today” / day-bound defaults. Display `toLocale*` stays wave 3; lint lock is wave 5.

| Area | Change |
|------|--------|
| Bank satellite | EOD picker / lock banner / executive TB / AccountModals range / ProductFactory `effectiveFrom` → `todayBakuYmd` / `addBakuDays` |
| Bank-core | `data-hub.client` `isoDateBaku` → kit `bakuDateKey` (no UTC fallback); `@db.Date` asOf slices left |
| CRM | follow-up default `fromDate` + due 09:00 via `parseBakuDateTime` |
| Logistics | fuel report from/to; trip SLA `from` |
| Wholesale | import-order `orderDate` + admin due preview |
| Auto | calendar `from`; appointment day snap keeps Baku wall time (`bakuDateKey` + `parseBakuDateTime`); cron tomorrow + 10:00 Baku slot |
| Finance mop-up | council week key; AR/AP aging `resolveReportAsOf` Baku; extension customs `bgdDate` inline Intl |
| Hotel/clinic/F&B/orch | rg: no remaining `new Date().toISOString().slice(0,10)` as today in app/src (seed `beoDate.setHours` left) |
| Construction / retail / bank-dbo | no today antipatterns found |
| Root scripts | CI/smoke report dates via `scripts/lib/today-baku-ymd.mjs` (no kit in .mjs) |

UAT: bank EOD business date = Asia/Baku; auto appointment snap preserves Baku HH:mm (18:36 → 14:36Z).

### Thin-spot pass (post wave 4)

- **Bank-core:** `replay-day.mjs` default today; EOD `capturedAt` window → `bakuDayBounds`; IRRBB `asOfDate` range → `bakuCivilUtcDate` + `addBakuDays`.
- **Finance:** cashflow projection horizon; HR birthday/contract cron; trade-credit `utcToday`; council snapshot year; depreciation posting month → Baku period key.
- **Orch:** hard-block escalation cron → `previousBillingPeriodKeyBaku` (removed UTC previous-month helpers).
- **Bank / DBO:** interbank maturity +7 civil days; standing-order `nextRunAt` → tomorrow 09:00 Baku; wire script aligned.
- **Clinic:** `ageYearsFromBirthDate` vs Baku “as of”.

Left alone: `@db.Date` `T00:00:00.000Z` civil anchors (hotel reports/HK); seed-only; Excel workforce-date; month arithmetic on YYYY-MM strings.

## Implementation wave 5 (lint lock)

Offline scanner + empty baseline; wired into quality gates. **Do not** set `TZ=Asia/Baku` on Docker/CI as the platform fix.

| Artifact | Role |
|----------|------|
| `scripts/lint-baku-clock.mjs` | Rules: `utc-today`, `utc-today-offset`, `locale-no-tz`, `host-midnight`, `tz-env` |
| `scripts/baselines/baku-clock-baseline.json` | Empty `hits: []` — any new hit fails default mode |
| `npm run lint:baku-clock` / `:update` / `test:baku-clock` | Local via `run:quality-gates`; GitHub `ci.yml` packages job uses `:strict` + tests |
| `--strict` | Any hit = FAIL (`run:quality-gates:strict` / ship prepush strict) |

Allow escape (same or previous line): `// baku-clock-allow: <rule> <reason>`.

Skipped: number `toLocaleString` with fraction digits or locale-only args; `toLocale*` with `timeZone:`; `@db.Date` receiver `.toISOString().slice` (not `new Date()`); kit `baku.ts`; seeds / `__tests__` / `prisma` / `scripts` dirs. `utc-today` / `host-midnight` match across newlines.

Scan roots include `era-*/{app,src,lib}`, finance/orch/data-hub/bank-core `apps` + bank-core `tools`, kit `src`, plus Dockerfiles / entrypoints / compose / `.github/workflows` for `tz-env` (`TZ: UTC` is allowed; `TZ=Asia/Baku` is not). `@era/satellite-kit/ui` must not import `time/baku`.

Hygiene: clinic `@/lib/baku-day` and orch/finance `baku-billing.util` remain thin kit re-exports; hotel NA logs `createdAt` → `bakuDateTimeDisplay`.

### Final audit (post waves 0–5)

Closed leftovers that the wave lists missed:

- Clinic appointment SMS used UTC `.slice(0,16)`; patient timeline had a local `bakuTimeLabel` copy.
- Orch/finance `billing-platform` still keyed subscription invoice months from UTC `paidAt`; PDF period labels now `bakuDateKey`.
- Finance contracts “today”, dashboard last-30-days, counterparty recon default period, FA monthly depreciation previous month; orch/finance `scripts/billing-reconciliation.ts` period bounds.
- Orch timesheets page duplicated Intl instead of `todayBakuYmd`; bank collections PTP / FX `valueDate` UI used `new Date().toISOString()`.

Left alone: `@db.Date` / hireDate / check-in civil UTC slices; seed/`scripts`/`_tmp_utf8` generators; event `occurredAt` instants; number `toLocaleString`; CBAR previous-day walk on already-civil `@db.Date` noon.

## Enforcement

```bash
npm run lint:baku-clock
npm run lint:baku-clock -- --strict
npm run test:baku-clock
npm run run:quality-gates          # includes baku clock (baseline)
npm run run:quality-gates:strict   # baku clock --strict
```

Implementation waves **0–5 landed**. Status remains **Accepted**.