# Hotel Demo / TE sign-off — Product Readiness UI + Demo green

**Product:** hotel  
**Wave:** W3 UI / Demo  
**Date:** 2026-08-04  
**Result:** `demo-te-pass` (lab walkthrough; **not** pilot field / GA)

## Scope

Live UI script (no curl) covering FO money + City Ledger show path after UI deepen:

1. Company stay + contract → charges → leave on CL  
2. Guest stay → deposit → settle DEPOSIT → refund → discount → checkout  
3. Gate fail demo (no contract)  
4. Agency ledger apply payment (+ Finance deep link when configured)  
5. NA polish preview on `/operations`  
6. FO assign / check-in / check-out (EraModal CL confirm with balance preview)

## Surfaces exercised

| Surface | Path | Notes |
|---------|------|-------|
| Chessboard CL | FO desk | EraModal Leave on CL vs Pay guest; DIRTY assign copy |
| Folio settle | `/folio/[id]` | Deposits, discount, tender lines, refund modal, checkout modes |
| Agency ledger | `/reports/agency-ledger` | Apply payment + Finance invoices link |
| Operations | `/operations` | NA polish preview trial panel (i18n) |
| B2B | `/admin/contracts`, allotment | Filter/reset + empty states |
| Banquets | `/banquets/[id]` settlement | Clarified vs guest folio |
| HK | `/housekeeping` | EraListFilterBar focus + status flow hint |

## i18n

P5 cash/CL strings localized **en / az / ru** (folio, chessboard, operations, agency ledger, HK, banquets).

## Honesty

- **UI ✅** and **Demo / TE ✅** for showable `mvp` only.  
- **Pilot lab** remains open until UAT-SMOKE §27 signed (`reports/hotel-pilot-lab-signoff.md` optional).  
- **Pilot field** / edition `ga` **out of scope** — do not claim GA.  
- KKM / INT remain STUB where previously declared.

## Evidence links

- Plan: `.cursor/plans/hotel_ui_readiness_green.plan.md`  
- Prior BE: `reports/hotel-stage-W2-signoff.md`  
- PRM: `docs/acceptance/Hotel-Product-Readiness-Matrix.md`
