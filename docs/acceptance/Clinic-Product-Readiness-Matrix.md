# Clinic — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/clinic.yaml`](../editions/clinic.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-03 yesterday start + diagnostics sheet):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Yesterday start (only with no seated procedures) and the studies list (labs plus package and payable visits) do not lift Demo or Pilot.

**Closeout (2026-11-02 print extra language + lab rooms):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Extra language is a print-branding option, not a new screen. Lab room filter does not lift Demo or Pilot.

**Closeout (2026-11-02 nurse list + lab clicks):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Nurse list and print are the same `/nurse` surface (not a new sell screen). Lab click and lab-tech room filter do not lift Demo or Pilot.

**Closeout (2026-11-02 stay reconcile):** CLI-54 stays SCREEN. AC-CLI-SAN-PAX stays 🟡. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. The reconcile is HEADLESS (no new screen).

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Clinic** | ✅ | ✅ | 🟡 | 🟡 | [ ] | [ ] | `mvp` | do not claim GA — fiscal/HL7 STUB; pilot open. DatePicker on package start, shifts, and same-day-until does not move this rollup |

---

## UI (short)

**UI class rollup:** SCREEN — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Ops home / appointments / nurse | `/, /appointments, /nurse` | 🟡 (CLI-26 Late + day list/print `/print/nurse-day`; 2026-10-30 `from`/`to` range, no Həkim, range-neutral KPI copy; analyses and diagnostics are separate home tiles — does not lift Demo/Pilot) |
| Resource day matrix | `/sanatorium/resources` | 🟡 SCREEN (CLI-26: modal Check-in when `receptionProcedureCheckIn`; no bar Köçür/Ləğv et; UAT §4 punched path deepen — not Demo lift) |
| Patient registry (P-codes, Ad/Soyad/Ata; Open-course badge; room/package on `/sanatorium`) | `/patients` | 🟡 SCREEN (wave UX landed; field UAT open) |
| Nurse / lab monthly rotation | `/sanatorium/nurse-roster` | ✅ SCREEN (CLI-38 + CLI-38b: dual view + day override) |
| МКБ санаторий | `/sanatorium` | 🟡 (2026-10-30 arrival + sort; 2026-11-02 1-click select / 2-click open Guest — list deepen only; not SHOW) |
| Lab orders (q filter, Name (CODE), cancel ORDERED, repeat confirm) | `/lab-orders?lane=lab` and `?lane=diagnostic` + patient-card **Diagnostics** tab | 🟡 SCREEN (1-click select / 2-click open; lab-tech room filter via episode read; two list lanes, same order card; assign modal = package lanes + modality folders + Ödəniləcək; locked auto studies; package quota scales off this tab; no Pay on card; Extra tickets hide CLOSED episodes; UAT open — not SHOW) |
| МКБ карточка пациента | `/patients/[id]` (after contraindications) | 🟡 |
| Nafta intake checklist (CLI-25/32/34) | `/patients/[id]` İlkin diaqnostik prosedurlar; `/print/checkup/[patientId]` 4 sections | 🟡 SCREEN (not WO `#33`; UAT open) |
| Nafta slots clock (CLI-25/48) | Card now/next + compact PLAN — Baku labels, `scheduledAt >= now` | 🟡 SCREEN (re-Apply `#23` required on droplet) |
| МКБ визит/стационар | `/visits/[id]`, `/inpatient` | 🟡 |
| Visit exam CPOE + print (CLI-10) | `/visits/[id]` CPOE; `/patients/[id]` exam notes; `/print/visit-exam/[id]` | ✅ SHOW (UAT-SMOKE punched; FHIR/whole-visit debt) |
| МКБ отчёт | `/reports/diagnoses` (меню Hesabatlar) | 🟡 (Fəsil `CatalogField`; chapter I/XIV `titleAz` short in catalog — droplet re-sync) |
| Пациенты по странам | `/reports/patients-by-country` | 🟡 SCREEN (CLI-56; UAT open) |
| ICD favorites admin | `/admin/icd-favorites` | 🟡 |
| SatAdmin catalogs | `/admin/*` | 🟡 |
| Cashier | `/cashier` | 🟡 |
| Print | `/print/*` | 🟡 — procedure, episode, and checkup dates render `дд.мм.гггг`. Guest procedure sheet can repeat name and note in `procedurePrintExtraLang` (lighter line; off by default). Assigned studies list is `/print/studies`. Plan print and + sit on the day-chip row. Package start, practitioner dates, and same-day-until are `DatePicker` |
| Procedure TTK BOM (CLI-47) | `/admin/master-data` (procedure types) | 🟡 API (UAT sign-off open) |
| Physio sites S (CLI-49) | `/admin/physio-sites` (Unmatched); card chips + Solyuks/`NAFTALAN_FILL` + empty-catalog banner + PLAN site titles | 🟡 SCREEN (seed S then re-Apply `#23`; UAT open) |
| Extra tickets (Nafta dual-run) | `/reception/extra-tickets` + `/print/extra-ticket/[ticketId]` | ✅ SHOW (procedures + unpaid labs/visits Pay desk; kind badge + title search; HOT-06 extension write still HEADLESS; not SHIPPED) |
| Local staff password (CLI-WF-PWD-01) | `/account/password` | 🟡 SCREEN (UAT listed; not SHOW / not GA) |
| Doctor first-day confirm (CLI-52 / Wave C) | `/sanatorium` + card proposed; `/admin/settings` scheduling mode | 🟡 SCREEN (no Confirm all; FIFO kept; UAT open; not SHIPPED) |
| Doctor bonus extras (CLI-53 / Wave D) | `/reports/procedures` fulfillment + doctor-bonus | 🟡 SCREEN (package/extra assigned vs completed; amount = completed paid extras; prescriber stamped; % stay 0 until FO; UAT open; not SHIPPED) |
| Paid revenue by code (CLI-63) | `/reports/revenue` | 🟡 SCREEN (paid extras, labs, exams; code resolved at read; UAT open; not SHIPPED) |
| Patient assignment ledger (CLI-64) | `/reports/patient-assignments` + `/print/patient-assignments/[episodeId]` | 🟡 SCREEN (one episode; procedures/labs/visits; room+kind; amount after acceptance; print; UAT open — not SHOW / not Pilot) |
| One stay two episodes (CLI-54 / Wave E) | `/sanatorium` multi-row same room | 🟡 SCREEN (same surname stays two rows; 1-click select / 2-click open Guest; nationality code, first doctor, hotel checkout; UAT open; not SHIPPED) |
| Episode as care course (CLI-55) | `/patients/[id]` episode select + archive blocks | 🟡 SCREEN (built; in-house room change and stay-product room write the door on open episodes; UAT open — not SHOW / not Pilot) |
| Role access matrix (CLI-RBAC-01) | `/admin/access` | 🟡 SCREEN (Phase A + custom roles/seed; UAT listed; not SHOW / not Pilot) |
| Package/extras assign (CLI-57) | `/sanatorium` patient card Package + **Diagnostics** tabs + `/reception/extra-tickets` Pay | 🟡 SCREEN (plan-before-pay; bath Saxla walks the pinned day, then afternoon, then next-day morning; `seatMiss` on a moved pin; later Save uses the remembered hour or the current hour; package_assign audit startOn; auto LAB analyses+diagnostics stamp inPackage + day-1/GET heal within remaining; course create writes those auto labs and visits (episode open does not); procedure menu excludes labs/visits in API and modal; Diagnostics modality folders; package quota scales only on Paket; Extra tickets hide CLOSED episodes; UAT open — not SHOW) |
| Walk-in groups (CLI-61) | `/sanatorium/walk-in-parties` list + ModalShell CRUD | 🟡 SCREEN (empty selects; sticky doctor; physio on procedure; line grid + Eye; no journal in ops modal; hotel pending basket with `revenueCode`; UAT §11a open — not SHOW) |
| Open attendance (CLI-62) | Admin type checkbox; plan/print label; `/nurse` seat-on-arrival; `/sanatorium/resources` foresight; settings SAME_DAY | 🟡 SCREEN (day-bucket + SAME_DAY; different OPEN codes share a day, same code once; OPEN unseated day-anchor excluded from FIXED restGap / overlap / compatibility; Pay keeps pin; UAT §11b open — not SHOW / not Pilot) |
| List / filter kit (CLI-37) | `EraListFilterBar` / `EraListWorkspace` + kit `CatalogField` SEARCHABLE | ✅ — 2026-11-02 combobox dismiss (outside pointer/focus / Escape / clear). Cross-satellite kit; does not move Gate, Demo, Pilot, or Sell |
| Mutation audit (CLI-19) | `/admin/audit` + `GET /api/admin/audit` (CatalogField incl. ClinicReceipt/ClinicShift; nav Mutation audit en/az/ru) | 🟡 SCREEN/SHIPPED viewer — Layer A + Wave B cashier SETTLE/VOID + shift + Wave E compound index (2026-10-29); HTTP_MUTATION UAT open; hash-chain deferred. Does not move Gate, Demo, Pilot, or Sell |

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off. TTK is documented only — does not change sell (still do not claim GA). CLI-55 episode-course card is **SCREEN** (built; UAT open) — not SHOW / not Pilot. CLI-57 plan-before-pay is **SCREEN** on the same row: it does not lift UI, Demo, or Pilot. Paid diagnostics money/UX amend (2026-11-01) stays **SCREEN** on Lab + CLI-57 + Extra tickets rows — same rule (assign ≠ cash desk). CLI-61 walk-in groups are **SCREEN** on the same rule. CLI-62 open attendance is **SCREEN** on the same rule. CLI-64 patient assignment ledger is **SCREEN** on the same rule (print included; not SHOW / not Pilot). Line rollup stays 🟡 (worst of Gate ✅, BE ✅, UI 🟡, Demo 🟡, Pilot open → edition `mvp`).

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-clinic/doc/UAT-SMOKE.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/clinic.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: «SHARED / multi-tenant clinic SaaS» — AC-CLI-TENANT 🟡 until field two-org UAT. Nafta clinic already runs SHARED; that placement is not a sell claim.
