# Clinic — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 5 — negative-path suites `__tests__/cli-*-negative.spec.ts`.  
**Scope-cut:** AC-CLI-LAB = lab orders ops (not live HL7). AC-CLI-CASH = cashier settle/ops (not live KKM). HL7 CLI-23 + fiscal CLI-24 = External residual (like Hotel HOT-02).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CLI-MD | Master data (practitioners, rooms, resources, procedure types) | ✅ | [ ] | `__tests__/cli-md-negative.spec.ts` + CLI-01..04,30,36,38 | Negative: module gate; inactive practitioner / catalog |
| AC-CLI-OPS | Appointments + day-ops + reception queue | ✅ | [ ] | `__tests__/cli-ops-negative.spec.ts` + CLI-05,14,26,29 | Negative: module gate 403; cancel COMPLETED; reschedule deny |
| AC-CLI-PT | Patients / clinical card / demographics | ✅ | [ ] | `__tests__/cli-pt-negative.spec.ts` + CLI-06,25,28,40 | Negative: module gate; MDM identifier (FIN or passport+country, not phone); name parts to MDM; visit diagnoses CLI-40; card ICD without open episode. Anamnesis gate moved to episode (CLI-55) — demographics PATCH no longer requires it |
| AC-CLI-LAB | Lab orders ops + diagnostic catalog | ✅ | [ ] | `__tests__/cli-lab-negative.spec.ts` + CLI-11,12,32 | **Ops only** — illegal publish / collect / complete; not live HL7 |
| AC-CLI-SAN | Sanatorium chart + doctor-confirm FIFO | ✅ | [ ] | `__tests__/cli-san-negative.spec.ts` + CLI-13,31,38,39 | Negative: FIFO skip → 409; module gate; ICD empty/chapter reject (`__tests__/icd10-catalog.spec.ts`) |
| AC-CLI-SAN-PKG | Staff assign 4 Nafta SKUs + episode without hotel program (Wave A) | 🟡 | [ ] | `cli-san-negative` unknown template; CLI-50 | **Out of AC-CLI-SAN rollup** — dual-run assign; do not flip SAN |
| AC-CLI-SAN-QUOTA | PDF knots + nights recalc + charge by quota (Wave B) | 🟡 | [ ] | `__tests__/program-quota.spec.ts`; CLI-51 | **Out of AC-CLI-SAN rollup** |
| AC-CLI-SAN-DAY1 | Doctor first-day 2–3 confirm; no Confirm all (Wave C) | 🟡 | [ ] | FIFO gates unchanged; CLI-52 | **Out of AC-CLI-SAN rollup** — does not reopen SAN ✅ |
| AC-CLI-BONUS | Doctor bonus extras-only buckets (Wave D) | 🟡 | [ ] | CLI-53; bonusEligible | **Out of AC-CLI-SAN rollup** |
| AC-CLI-SAN-PAX | One stay two episodes (Wave E) | 🟡 | [ ] | CLI-54; openEpisode per patient | **Out of AC-CLI-SAN rollup** |
| AC-CLI-EPISODE | Episode as care course (card switcher, children, walk-in close) | 🟡 | [ ] | CLI-55; ADR clinic-episode-as-clinical-course; `__tests__/cli-episode-negative.spec.ts` + `cli-episode-gates.spec.ts` | **Out of BE rollup** until field UAT; SCREEN UI landed; Scaffold stays 🟡 |
| AC-CLI-RBAC | Configurable role×screen/API matrix (Variant A Waves 1–3) | 🟡 | [ ] | `cli-rbac-negative` + `cli-rbac-admin-negative` + `cli-rbac-ops-negative`; ADR clinic-domain-permissions-and-rbac; `/admin/access` | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-CLI-CASH | Cashier settle / ops | ✅ | [ ] | `__tests__/cli-cash-negative.spec.ts` + CLI-33 | **Settle/ops only** — visit/shift deny; live fiscal = External |
| AC-CLI-PRINT | Print forms + branding | ✅ | [ ] | `__tests__/cli-print-negative.spec.ts` + CLI-34 | Negative: missing source; unsupported lang |
| AC-CLI-CAP | Clinic→hotel capacity foresight | ✅ | [ ] | `__tests__/cli-cap-negative.spec.ts` + CLI-27 | Negative: critical risk blocks booking |
| AC-CLI-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit fail-closed tenant extension; Wave 2 clinic login/JWT/`enterSatelliteTenant` + lifecycle ALS; Wave 4 cron + capacity POST multi-org; Wave 5 lab `saas-wave5-two-org-isolation`; Wave 9 live pool smoke; Wave 10 cron User DISTINCT discover | **Excluded from Scaffold BE rollup.** Lab + live-smoke + cron discover available; still not Scaffold ✅ (field two-org UAT open). Signoff: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md) |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-CLI-TENANT, AC-CLI-SAN-PKG, AC-CLI-SAN-QUOTA, AC-CLI-SAN-DAY1, AC-CLI-BONUS, AC-CLI-SAN-PAX, AC-CLI-EPISODE, AC-CLI-RBAC) → **✅**.
AC-CLI-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.
AC-CLI-SAN-PKG is 🟡 and stays **out of Scaffold BE rollup** (does not reopen AC-CLI-SAN).
AC-CLI-SAN-QUOTA is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-SAN-DAY1 is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-BONUS is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-SAN-PAX is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-EPISODE is 🟡 (SCREEN landed; field UAT open) and stays **out of Scaffold BE rollup**.
AC-CLI-RBAC is 🟡 (Phase A shipped; field UAT open) and stays **out of Scaffold BE rollup**.
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CLI-LAB / CLI-23 | HL7 production adapter | External ⏸ | Scope-cut (like Hotel HOT-02) — not AC-CLI-LAB ops |
| AC-CLI-CASH / CLI-24 | Live fiscal KKM | External ⏸ | Scope-cut — not AC-CLI-CASH settle/ops |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| AC-CLI-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Wave 5 lab + Wave 9 live-smoke + Wave 10 cron discover; Scaffold ✅ still needs field pass |
| CLI-47 | Procedure TTK → Finance inventory | Out of BE plan | ADR `clinic-procedure-consumable-ttk`; API W1 (BOM+event); Finance write-off W2 |
| CLI-49 | Physio S + program/substance catalogs | Out of BE plan | Nafta card wave: Solyuks/`belinə`/`NAFTALAN_FILL`; empty-catalog UX; `#23` always `replaceSites`; UAT open until droplet seed + re-Apply proof |
| CLI-32 / CLI-34 / CLI-25 | Nafta intake checklist + Baku slots | Out of BE plan | `PKG-NAFTA-INTAKE` card/print + live instantiate; `#23` `parseBakuDateTime(+04:00)` + PLAN/now `gte now` — UAT punch in `UAT-SMOKE.md` |
| Dual-run extra tickets | Nafta Elektraweb SPA outbox | Out of BE plan | `/reception/extra-tickets`; HOT-06 HEADLESS; Wave 9 field runbook [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md). Not Scaffold / not SHIPPED. |
| CLI-55 / AC-CLI-EPISODE | Episode as care course | Out of BE plan | ADR `clinic-episode-as-clinical-course`; SCREEN W1–W5; AC stays 🟡 until field UAT; do not reopen AC-CLI-PT demographics anamnesis |
| CLI-56 | Episode care team (multi-doctor) | Out of BE plan | ADR `clinic-episode-care-team`; SCREEN; assigned-only scope + card gate; appointments link deferred |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-clinic/__tests__/cli-ops-negative.spec.ts` | AC-CLI-OPS |
| `era-clinic/__tests__/cli-pt-negative.spec.ts` | AC-CLI-PT |
| `era-clinic/__tests__/cli-md-negative.spec.ts` | AC-CLI-MD |
| `era-clinic/__tests__/cli-san-negative.spec.ts` | AC-CLI-SAN |
| `era-clinic/__tests__/icd10-catalog.spec.ts` | AC-CLI-SAN (CLI-39) + AC-CLI-PT (CLI-40) selectable ICD |
| `era-clinic/__tests__/cli-lab-negative.spec.ts` | AC-CLI-LAB |
| `era-clinic/__tests__/cli-print-negative.spec.ts` | AC-CLI-PRINT |
| `era-clinic/__tests__/cli-cap-negative.spec.ts` | AC-CLI-CAP |
| `era-clinic/__tests__/cli-cash-negative.spec.ts` | AC-CLI-CASH |
| `era-clinic/__tests__/cli-rbac-negative.spec.ts` | AC-CLI-RBAC (Wave 1) |
| `era-clinic/__tests__/cli-rbac-admin-negative.spec.ts` | AC-CLI-RBAC (Wave 2) |
| `era-clinic/__tests__/cli-rbac-ops-negative.spec.ts` | AC-CLI-RBAC (Wave 3) |
