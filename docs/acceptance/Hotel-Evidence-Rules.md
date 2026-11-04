# Hotel — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/hotel-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |
| AC-HOT-AUD Scaffold ✅ | Layer A belt on hotel mutations + deny-list/`audit-exempt` + CI fail-closed scan + negative: exempt path skips row, money path still succeeds if audit insert fails; UAT shows `/admin/audit` `HTTP_MUTATION` **and** a Layer B money/lifecycle sample (CashShift / DAY_CLOSE / folio VOID ok); reports-without-admin can open the page. ADR era-mutation-audit-standard. Wave B writers / Wave E compound index alone ≠ Scaffold ✅. Until then max 🟡 |

AC-HOT-CARD-PANE (HOT-BOOK-06…09): UAT §45–§48 open → stays 🟡. **2026-11-03** Guests party attach unit (`__tests__/party-pax-bands.spec.ts` place/reband/`guestId`) + second-pass (refs, hydrate counters, persist-fail toast) deepens HOT-BOOK-02 but does **not** lift CARD-PANE off 🟡 / not Scaffold ✅.

AC-HOT-FO / AC-HOT-CASH: **2026-11-03** corp+medical keep FO package + contract allotment `NO_ALLOTMENT_BAR` (hotel Avl when no quota row) deepen HOT-BOOK-02 / HOT-FO-02 / HOT-CL-01 / HOT-AG-01 — does **not** reopen Scaffold ✅; AC-HOT-PKG-NAFTA stays 🟡; Pilot / `hotel.yaml` unchanged. **Second-pass** GroupBooking + package-switch clear + medical toast suppress + ADR B2B — still not Scaffold reopen / not Pilot.

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/hotel-stage-<wave>.log
reports/hotel-stage-<wave>-signoff.md
reports/hotel-pilot-lab-signoff.md
```

UAT source: `era-hotel-pms/doc/UAT-SMOKE.md`
