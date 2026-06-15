# UAT smoke — era-bank-core

Headless CBS engine on `:4300`. Service token auth for satellite/BFF calls.

## Prerequisites

```bash
cd era-bank-core
cp .env.example .env
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

## Health

```bash
curl -sf http://127.0.0.1:4300/api/health
```

## P0–P1 Kernel (curl)

Set `TOKEN=dev-bank-core-service-token`, `BASE=http://127.0.0.1:4300/api/v1`.

| Step | Command / check |
|------|-----------------|
| Branches | `GET $BASE/branches` |
| CIF create | `POST $BASE/cif/customers` JSON natural person |
| Open account | `POST $BASE/accounts` with customer + branch + GL |
| Posting | `POST $BASE/postings` balanced legs, `autoApprove: true` |
| EOD | `POST $BASE/eod/run` body `{ "businessDate": "2026-06-14" }` — trial balance balanced |

## P2 Payments

| Step | Check |
|------|-------|
| Create order | `POST $BASE/payments/orders` |
| Submit | `POST $BASE/payments/orders/:id/submit` |

## P3 Products

| Step | Check |
|------|-------|
| Product templates | `GET $BASE/product-templates` |
| Term deposit | `POST $BASE/deposits/contracts` |
| Loan | `POST $BASE/loans/contracts` |

## P4 Compliance

| Step | Command / check |
|------|-----------------|
| Post above threshold | `POST $BASE/postings` with debit leg ≥ 15_000 AZN (1_500_000 minor) → AML alert created |
| AML alerts queue | `GET $BASE/aml/alerts` |
| Alert detail | `GET $BASE/aml/alerts/:id` |
| Assign / close | `PATCH $BASE/aml/alerts/:id` body `{ "status": "UNDER_REVIEW" }` |
| Escalate | `POST $BASE/aml/alerts/:id/escalate` |
| Sanction screen | `POST $BASE/aml/screen` body `{ "name": "SANCTION TARGET ALPHA" }` |
| FMN generate | `POST $BASE/aml/reports/fmn` body `{ "periodFrom": "2026-01-01", "periodTo": "2026-01-31" }` |
| FMN export | `GET $BASE/aml/reports/fmn/:id/export?format=json` |
| CBAR trial balance | `POST $BASE/reports/cbar/CBAR_TRIAL_BALANCE/generate` |
| CBAR export | `GET $BASE/reports/cbar/runs/:id/export?format=csv` |
| FATCA classify | `PUT $BASE/reports/fatca-crs/classifications/:customerId` |
| FATCA export | `GET $BASE/reports/fatca-crs?period=2026-06-14` |
| EOD → finance bridge | Run EOD balanced → `SATELLITE_BANK_GL_DAILY_SUMMARY` in finance journal |

## P5 DBO API

Set `BASE=http://127.0.0.1:4300/api/v1`, retail FIN `1234567`, corporate VOEN `1234567890`, OTP `123456`.

| Step | Command / check |
|------|-----------------|
| OTP request | `POST $BASE/dbo/auth/otp/request` body `{ "identifier": "1234567", "channel": "RETAIL" }` |
| OTP verify | `POST $BASE/dbo/auth/otp/verify` → `customerJwt` |
| Me | `GET $BASE/dbo/auth/me` header `X-Customer-Authorization: Bearer <jwt>` |
| Accounts | `GET $BASE/dbo/accounts` + customer JWT |
| Internal transfer | `POST $BASE/dbo/transfers/internal` 10000 minor between demo retail accounts |
| Payment create/sign/submit | `POST $BASE/dbo/payments/orders` → sign → submit |
| ASAN callback | `POST $BASE/dbo/auth/asan/callback` → `kycTrustTier=GOVERNMENT_VERIFIED` |
| Open API | `POST $BASE/dbo/open/payments/orders` header `X-Api-Key: dbo-demo-api-key-change-in-prod` |
| AML preflight | `POST $BASE/dbo/payments/orders/:id/preflight` |

## P6 Cards

```bash
node ../../tools/card-acquiring-stub.mjs authorize --amount 5000 --token <cardId> --ref stub-001
node ../../tools/card-acquiring-stub.mjs capture --ref stub-001
node ../../tools/card-acquiring-stub.mjs reverse --authTxnId <id-from-authorize>
```

| Step | Expected |
|------|----------|
| Authorize | `status: APPROVED`, note `id` for reverse |
| Capture | `status: SETTLED` |
| Reverse pending auth | hold `RELEASED`, txn `REVERSED` |
| Insufficient funds | `status: DECLINED`, `declineReason: INSUFFICIENT_FUNDS` |
| Blocked card | `status: DECLINED`, `declineReason: CARD_NOT_ACTIVE` |

## P7 Treasury

| Step | Check |
|------|-------|
| FX deal | `POST $BASE/treasury/fx-deals` |
| GAP | `GET $BASE/treasury/liquidity-gap` |

## Gate 1 minimum

CIF → account → deposit → cross-branch posting → payment → EOD with Σ Dr = Σ Cr.

## Unit tests

```bash
npm test -- --ci
```

Expected: posting-engine + interbranch-mfr + eod-balanced + aml-compliance + dbo-auth specs green.
