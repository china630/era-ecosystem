# Clinic — Evidence Rules

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + `reports/clinic-stage-*-signoff.md` |
| Scaffold ✅ | Test/golden covering AC **including negative path** — see `__tests__/cli-*-negative.spec.ts` |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | UAT-SMOKE lab RT signed + linked artifact |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | `pilot_ready: true` + Pilot field; yaml is SSOT |
| COVERAGE SHIPPED | Doc + API + actor UI + UAT UI path (see era-coverage-definition) |
| CLI-19 Layer A honesty | Viewer SHIPPED at `/admin/audit` + `GET /api/admin/audit`; fail-closed CI + Wave B cashier SETTLE/VOID + ClinicShift + Wave E compound `(organizationId, createdAt)` landed; dedicated `HTTP_MUTATION` filter UAT still open — does not unship CLI-19; Wave E index alone ≠ Scaffold ✅ AC |

## Negative-path suites (Green Scaffold BE wave 5)

| AC | Spec | UAT deny |
|----|------|----------|
| AC-CLI-OPS | `era-clinic/__tests__/cli-ops-negative.spec.ts` | UAT-SMOKE § Deny (CLI-26 matrix reception check-in deepen stays under existing suite + UAT §3–4; no Scaffold reopen) |
| AC-CLI-PT | `era-clinic/__tests__/cli-pt-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-MD | `era-clinic/__tests__/cli-md-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-SAN | `era-clinic/__tests__/cli-san-negative.spec.ts` + `__tests__/icd10-catalog.spec.ts` | UAT-SMOKE § Deny / ICD |
| AC-CLI-LAB | `era-clinic/__tests__/cli-lab-negative.spec.ts` | UAT-SMOKE § Deny (ops; not HL7) |
| AC-CLI-PRINT | `era-clinic/__tests__/cli-print-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-CAP | `era-clinic/__tests__/cli-cap-negative.spec.ts` | UAT-SMOKE § Deny |
| AC-CLI-CASH | `era-clinic/__tests__/cli-cash-negative.spec.ts` | UAT-SMOKE § Deny (settle; not live KKM) |

AC-CLI-TENANT stays out of BE rollup (schema+filter only). HL7 CLI-23 + fiscal CLI-24 = External residual.

AC-CLI-EPISODE (CLI-55) negatives: `__tests__/cli-episode-negative.spec.ts` + `__tests__/cli-episode-gates.spec.ts` (anamnesis / walk-in close / CLOSED read-only). Field UAT still open → AC stays 🟡.

AC-CLI-WALKIN-PARTY (CLI-61): unit `__tests__/walk-in-party.spec.ts` (placeholders/status). UI path UAT-SMOKE §11a open → AC stays 🟡; not Scaffold ✅.

AC-CLI-OPEN-ATTEND (CLI-62): unit `__tests__/open-attendance.spec.ts` (mode/quota/window helpers + `orderCountsForWallClockRest`) + `procedure-slot-scan` OPEN restGap / compat. Code also refuses matrix DnD of unseated OPEN, plan reschedule for OPEN, and SAME_DAY check-in without a cabin; 2026-10-30 OPEN unpaid extras day-bucket pin + Pay/settlement keeps pin. 2026-11-02 picker: different codes share a day, same code next working day, package block cap kept, extra past stay not stored; OPEN unseated day-anchor excluded from FIXED restGap / overlap / compatibility — still **no field negative path**. 2026-11-06 resource matrix draws that queue as morning/afternoon cabin bands (`summarizeOpenAttendanceBands`). UI path UAT-SMOKE §11b open → AC stays 🟡; not Scaffold ✅.

AC-CLI-ASSIGN (CLI-57): unit `__tests__/cli57-package-assign.spec.ts` + `__tests__/package-assign-redispatch.spec.ts` (line-order attach). 2026-10-30 Saxla same-block redispatch + modal № + Pay keeps OPEN pin — still **no field negative path**. 2026-11-01 diagnostics lane parity (assignedStudies lock, accordion, Ödəniləcək) / Extra tickets labs+visits / package amountNet 0 / hidden study burns via `studyBalances`; 2026-11-02 package quota scales off Diaqnostika, procedure menu `PROCEDURE_ORDER` in API and modal, modality folders, day-end/checkout/walk-in close cancel unpaid labs and visits; pinned bath day walks `day_full`/`same_day`/`no_staff`/`closed` (`__tests__/procedure-slot-scan.spec.ts`); later Save and masseur reseat `saxlaRepeatClock` (null `startHour` does not reset the hour) (`__tests__/clinic-day-next-working.spec.ts`); `seatMiss` — still **no field negative path**; prior bath pin afternoon → next-day morning+afternoon + package_assign audit `startOn`/`startHour`; auto LAB analyses+diagnostics `packageStamp` + `healUnstampedPackageAutoLabs` (assign GET + day-1 linkExisting; remaining-quota unit) (`__tests__/package-auto-apply.spec.ts`) — UAT open → AC stays 🟡; not Scaffold ✅.

AC-CLI-LAB paid-diagnostics money: `__tests__/diagnostics-package-money.spec.ts` + heal/pending filters; auto LAB stamp/heal unit in `package-auto-apply.spec.ts` (labs without a doctor, no duplicate on the next pass); course create calls that apply (`cli-san-negative.spec.ts`); ops Scaffold ✅ unchanged; list lanes `__tests__/lab-order-lane.spec.ts` (2026-11-04: unlinked ECG/US/endoscopy off analyses; open duplicate blocked per patient (an older open order wins over a newer completed one) in `lab-order-conflict` + `lab-order-cancel.spec.ts`; `repairOpenLabDuplicates` cancels every extra open row of the same code, linked or not; not run — no local clinic DB); home day-summary uses the same two lanes; field diagnostics UX UAT still open.

AC-CLI-ASSIGN-LEDGER (CLI-64): unit `__tests__/patient-assignment-ledger.spec.ts` (amount/completion helpers). UI path UAT-SMOKE «Patient assignment ledger (CLI-64)» open → AC stays 🟡; not Scaffold ✅.

## Forbidden as sole proof

- Chat assertion without artifact
- Green stage-gate alone → Scaffold ✅
- MODULES_CATALOG DONE → sell/show ✅
- Soft partner-GA prose while yaml = `mvp`

## Artifact naming

```
reports/clinic-stage-<wave>.log
reports/clinic-stage-<wave>-signoff.md
reports/clinic-pilot-lab-signoff.md
```

UAT source: `era-clinic/doc/UAT-SMOKE.md`
