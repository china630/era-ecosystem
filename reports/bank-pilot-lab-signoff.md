# Bank Pilot lab signoff — YC-D1

- Product: bank
- Wave: YC-D1 Pilot lab
- Date: 2026-08-06
- Result: lab-rt-kit-ready

## Scope

Expanded `era-bank/doc/UAT-SMOKE.md` (pricing, capital, EOD steps + UI envelope steps 17–24) + TE pack `reports/bank-te-demo-signoff.md`.

## Automated gates

- `npm run check:acceptance` — expected PASS
- Bank-core unit suites for JWT/HMAC, repay, pricing SoD, payments SoD

## Human UI RT

Checklist in UAT-SMOKE is **operator-executable** for the full ops module envelope (cash/fees/SO, loans-deep/collections, trade, islamic/wealth/AML/3DS). Line Product-Readiness Pilot lab `[x]` = **lab** full envelope only.

## Honesty

- Edition stays `mvp` / `pilot_ready: false`
- Pilot **field** remains `[ ]` (YC-E7)
- No certified risk / live rails / live SWIFT claims
