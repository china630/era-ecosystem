# UAT smoke — era-bank-dbo

Customer digital banking channel (port **3211**). BFF proxies to `era-bank-core` `/api/v1/dbo/*`. Channel DB holds sessions and sign workflow only — **no balances**.

## Prerequisites

- Postgres database `era_bank_dbo`
- `era-bank-core` running on `:4300` with `banking_dbo` module (Sprint 3 engine wave)
- Copy `.env.example` → `.env.local`

```bash
cd era-bank-dbo
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:3211/login`

## Platform

- [ ] `GET /api/health` → `{ status: "ok", service: "era-bank-dbo" }`
- [ ] PWA manifest at `/manifest.webmanifest`

## Retail journey (UI — no curl)

1. **`/login`** — Retail tab, enter demo FIN, click **OTP göndər**.
2. Enter dev OTP `123456`, **Təsdiqlə** → redirect `/dashboard`.
3. **`/dashboard`** — total balance card loads from engine via BFF.
4. **`/accounts`** — account cards with IBAN mask and balance.
5. **`/accounts/[id]`** — account detail.
6. **`/transfers`** — internal transfer between own accounts (100 AZN smoke).
7. **`/payments/new`** — create external payment → sign → submit → listed on **`/payments`**.
8. **`/standing-orders`** — create SO from owned account → listed; **Pause** → status PAUSED.
9. **`/loans/apply`** — create draft → **Submit** → status SUBMITTED (no book in DBO).
10. **`/cards/3ds`** — complete PENDING challenge (Approve/Deny) after ops created challenge.
11. **`/islamic`** — read-only contract list (activate stays in ops).

## Negative paths (lab)

- [ ] Bad OTP code → error shown; session not created
- [ ] Transfer amount > available balance → engine/BFF error surfaced in UI
- [ ] Corporate dual-sign: second signatory rejects / does not complete → order stays PENDING (not POSTED)
- [ ] ASAN stub badge visible on `/login`
- [ ] Standing order create without session / wrong account → 401 / forbidden surfaced
- [ ] Loan apply submit for another CIF → not visible / forbidden

## Corporate signatory (UI)

1. **`/login`** — Corporate tab, VÖEN + OTP login as user A.
2. **`/payments/new`** — create payment ≥ corporate threshold → `PaymentSignRequest` PENDING in channel DB.
3. Log out; login as signatory B (corporate).
4. **`/payments/approve`** — queue shows pending order → **ASAN ilə imzala** → submit.
5. Order routes through engine payments module → POSTED (engine UAT).

## Customer cards (Sprint 4 stretch)

1. After retail OTP login, open **`/cards`** — masked PAN list from engine `GET /dbo/cards`.
2. Open card detail — **`/cards/[id]`** shows status and expiry.
3. **Temporary block** — button calls `POST /dbo/cards/:id/temporary-block`; card status becomes `BLOCKED`.

## Open API (curl — B2B)

Requires engine `/api/v1/dbo/open/*` and seeded API key (`npm run db:seed` prints key).

```bash
curl -s -X POST http://127.0.0.1:4300/api/v1/dbo/open/payments/orders \
  -H "X-Api-Key: dbo-demo-api-key-change-in-prod" \
  -H "Content-Type: application/json" \
  -d '{"debitAccountId":"...","beneficiaryIban":"AZ...","amountMinor":10000}'
```

## Schema audit

- [ ] Channel Prisma has only `CustomerSession`, `CorporateApiKey`, `PaymentSignRequest` (+ enums)
- [ ] No ledger/balance tables in `era_bank_dbo`
