# ERA Bank (satellite) — Technical Specification (TZ)

**Scope:** `era-bank` — operational banking satellite (`industry_banking` gate); UI/workflow client of the headless engine `era-bank-core`.
**Companion:** [PRD.md](./PRD.md) · engine [era-bank-core/TZ.md](../era-bank-core/TZ.md) · ADR [docs/adr/era-bank-core.md](../docs/adr/era-bank-core.md) D9.
**Stack:** Next.js (web + `/api` route handlers) + Prisma + PostgreSQL; `next-intl` + `@era/i18n-common`; `@era/satellite-kit` (SSO, entitlement, UI shell). Consistent with other industry satellites.

---

## §0. Service topology

| Component | Tech | Port (dev) | DB |
|-----------|------|------------|----|
| `era-bank` web + `/api` | Next.js | **3210** | `era_bank` (operational/UI state only) |
| `era-bank-core` engine | NestJS | 4300 | `era_bank_core` — see [era-bank-core/TZ.md](../era-bank-core/TZ.md) |

`era-bank` calls the engine over `era-network` (`ERA_BANK_CORE_URL=http://bank-core:4300`) with a service token, forwarding the user's JWT for context.

Env (canonical, [ECOSYSTEM_URLS.md](../docs/ECOSYSTEM_URLS.md)):

| Variable | Meaning |
|----------|---------|
| `ERA_BANK_ORIGIN` | Public origin of the satellite |
| `ERA_BANK_CORE_URL` | Internal engine API base |
| `BANK_CORE_SERVICE_TOKEN` | Service token for satellite→engine calls |
| `ERA_BANK_ORGANIZATION_ID` | The single bank org (one deployment = one bank) |
| `BANK_SATELLITE_DB` | `era_bank` |
| `ERA_JWT_*` | SSO verification (orchestrator issuer) |

## §1. Architecture

```
era-bank/                       # operational satellite (UI)
  app/                          # Next.js routes (screens) + /api route handlers (BFF)
    (auth)/                     # local ops login + SSO callback
    cif/  accounts/  postings/  # banking_core screens
    deposits/ loans/ cards/ payments/ aml/ treasury/ reports/
    admin/product-factory/      # product authoring (stored in engine)
    api/                        # BFF: forwards to era-bank-core engine API
  prisma/                       # era_bank schema (ops/UI state only — NO ledger)
  lib/                          # engine client, entitlement, session
```

**Binding rule (ADR D9):** no ledger/money tables in `era_bank`. The BFF (`app/api/*`) is a thin proxy to `era-bank-core`; it adds auth/entitlement checks and shaping, never business postings.

## §2. Data model (`era_bank` — operational only)

```prisma
model OpsUser {                 // local operational staff (branch-bound)
  id           String  @id @default(cuid())
  username     String  @unique
  passwordHash String?            // SSO users: "sso:no-password"
  globalPersonId String?          // MDM ref (provisioned from finance HR)
  branchId     String             // operating branch (engine Branch id)
  status       OpsUserStatus
}

model OpsRole {                  // local operational role + limits
  id        String @id @default(cuid())
  code      String              // TELLER | BRANCH_MANAGER | AML_OFFICER | ...
  limitsJson Json               // posting/approval limits used for maker-checker UX
}

model OpsSession {              // teller drawer / login session
  id        String @id @default(cuid())
  opsUserId String
  branchId  String
  openedAt  DateTime
  closedAt  DateTime?
}

model OpsActionLog {            // operational UI action audit (NOT the ledger audit)
  id        String @id @default(cuid())
  opsUserId String
  action    String
  refType   String?             // engine entity referenced (e.g. JournalTransaction id)
  refId     String?
  at        DateTime @default(now())
}
```

Ledger truth, postings, balances, customer master, product instances — all in `era-bank-core`. `era-bank` references engine IDs, never copies balances.

## §3. Auth & entitlement

- **Staff:** local ops login (`POST /api/auth/login`), branch-bound, no org picker. `passwordHash` on `OpsUser`.
- **Owner/management:** orchestrator SSO via `@era/satellite-kit` `executeSatelliteSsoExchange`; signed `organizationId`.
- **Entitlement:** read snapshot from orchestrator; gate module routes via `assertIndustryModuleActive('industry_banking')` + per-`banking_*` checks.
- **Maker-checker UX:** `OpsRole.limitsJson` drives which actions need a checker; the **enforcement is server-side in the engine**, the satellite only reflects state and routes approvals.
- Staff provisioning: `OpsUser` created/updated from finance HR `STAFF_PROVISIONED` (consumed by the engine, mirrored to satellite, stamping `globalPersonId`).

## §4. BFF ↔ engine contract

Every money/data route is a typed proxy to `era-bank-core` (engine TZ §8). Example:

```ts
// app/api/postings/route.ts (BFF)
// POST -> validate session + entitlement (banking_core) + branch scope
//      -> forward to ERA_BANK_CORE_URL + '/api/v1/postings'
//         with Authorization: user JWT + X-Service-Token: BANK_CORE_SERVICE_TOKEN
//         and an idempotency key
//      -> return engine response (no local persistence of money state)
```

Routes mirror engine API families: `cif`, `accounts`, `postings`, `gl`, `branches`, `eod`, `deposits`, `loans`, `cards`, `payments`, `aml`, `treasury`, `reports`, `product-templates`.

## §5. i18n & UI

- `next-intl` + `@era/i18n-common`; locales az/ru/en; default **az**; cookie `era_i18n_lang`.
- App shell: `@era/satellite-kit/ui` `EraAppRouteShell` (header order, sidebar width) per [UI_PLAYBOOK_SATELLITES.md](../docs/UI_PLAYBOOK_SATELLITES.md).
- Login UI: shared `AuthLoginCard` ([DESIGN.md](../DESIGN.md)).
- No raw enum/DB keys in UI; localized labels + badges.

## §6. Security

- SSO + local ops auth; engine calls carry user JWT + service token.
- `OpsActionLog` records operational actions; the **immutable ledger audit** is in the engine.
- No PII stored beyond display caches; identity master in MDM (resolved by engine).
- Posting-locked UX during engine EOD window.

## §7. Phases & DoD

| Phase | DoD |
|-------|-----|
| **P0–P1** | App boots (`:3210`, DB `era_bank`); SSO + local ops auth; entitlement gate `industry_banking`; CIF/account/posting maker-checker screens drive engine API; EOD console; branch admin; BFF has zero money persistence (verified). |
| **P2** | Payment order entry/approval + rail status screens over engine `/payments/*`. |
| **P3** | Deposit & loan servicing screens + Product Factory authoring (persisted in engine). |
| **P4** | AML queue + FMN builder; CBAR reporting screens. |
| **P6** | Card servicing screens. |
| **P7** | Treasury/ALM dashboards. |

Each phase: DELIVERY checkboxes (`doc/DELIVERY-BANK.md`), UAT smoke (`doc/UAT-SMOKE.md`), doc updates per [documentation-upkeep](../.cursor/rules/documentation-upkeep.mdc).

## §8. Open questions

- Whether owner management dashboards live here or in the orchestrator launcher.
- Operational session model for teller drawers vs engine cash/vault accounts.
- Offline/branch-resilience expectations for teller screens during engine maintenance.
