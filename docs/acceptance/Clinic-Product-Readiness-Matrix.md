# Clinic — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/clinic.yaml`](../editions/clinic.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

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
| Ops home / appointments / nurse | `/, /appointments, /nurse` | 🟡 (CLI-26 Late + 2026-10-30 `from`/`to` range, no Həkim, range-neutral KPI copy — does not lift Demo/Pilot) |
| Resource day matrix | `/sanatorium/resources` | 🟡 SCREEN (CLI-26: modal Check-in when `receptionProcedureCheckIn`; no bar Köçür/Ləğv et; UAT §4 punched path deepen — not Demo lift) |
| Patient registry (P-codes, Ad/Soyad/Ata; Open-course badge; room/package on `/sanatorium`) | `/patients` | 🟡 SCREEN (wave UX landed; field UAT open) |
| Nurse / lab monthly rotation | `/sanatorium/nurse-roster` | ✅ SCREEN (CLI-38 + CLI-38b: dual view + day override) |
| МКБ санаторий | `/sanatorium` | 🟡 (2026-10-30 arrival column + sort before room — list deepen only) |
| Lab orders (q filter, Name (CODE), cancel ORDERED, repeat confirm) | `/lab-orders` + patient-card **Diagnostics** tab | 🟡 SCREEN (paid episode labs/imaging/visits: prescribe+Pay; card Pay/delete; editable visit draft; catalog kind label; unpaid labs/visits work-gated until `settledAt` — ADR clinic-paid-diagnostics-from-episode; UAT open — not SHOW; does not lift Demo/Pilot) |
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
| Print | `/print/*` | 🟡 — procedure, episode, and checkup dates render `дд.мм.гггг`. Package start, practitioner dates, and same-day-until are `DatePicker` |
| Procedure TTK BOM (CLI-47) | `/admin/master-data` (procedure types) | 🟡 API (UAT sign-off open) |
| Physio sites S (CLI-49) | `/admin/physio-sites` (Unmatched); card chips + Solyuks/`NAFTALAN_FILL` + empty-catalog banner + PLAN site titles | 🟡 SCREEN (seed S then re-Apply `#23`; UAT open) |
| Extra tickets (Nafta dual-run) | `/reception/extra-tickets` + `/print/extra-ticket/[ticketId]` | ✅ SHOW (Wave 6 lab; HOT-06 extension write still HEADLESS; not SHIPPED) |
| Local staff password (CLI-WF-PWD-01) | `/account/password` | 🟡 SCREEN (UAT listed; not SHOW / not GA) |
| Doctor first-day confirm (CLI-52 / Wave C) | `/sanatorium` + card proposed; `/admin/settings` scheduling mode | 🟡 SCREEN (no Confirm all; FIFO kept; UAT open; not SHIPPED) |
| Doctor bonus extras (CLI-53 / Wave D) | `/reports/procedures` fulfillment + doctor-bonus | 🟡 SCREEN (package/extra assigned vs completed; amount = completed paid extras; prescriber stamped; % stay 0 until FO; UAT open; not SHIPPED) |
| Paid revenue by code (CLI-63) | `/reports/revenue` | 🟡 SCREEN (paid extras, labs, exams; code resolved at read; UAT open; not SHIPPED) |
| Patient assignment ledger (CLI-64) | `/reports/patient-assignments` + `/print/patient-assignments/[episodeId]` | 🟡 SCREEN (one episode; procedures/labs/visits; room+kind; amount after acceptance; print; UAT open — not SHOW / not Pilot) |
| One stay two episodes (CLI-54 / Wave E) | `/sanatorium` multi-row same room | 🟡 SCREEN (same surname stays two rows; nationality code, first doctor, hotel checkout; UAT open; not SHIPPED) |
| Episode as care course (CLI-55) | `/patients/[id]` episode select + archive blocks | 🟡 SCREEN (built; in-house room change and stay-product room write the door on open episodes; UAT open — not SHOW / not Pilot) |
| Role access matrix (CLI-RBAC-01) | `/admin/access` | 🟡 SCREEN (Phase A + custom roles/seed; UAT listed; not SHOW / not Pilot) |
| Package/extras assign (CLI-57) | `/sanatorium` patient card Package + **Diagnostics** tabs + `/reception/extra-tickets` Pay | 🟡 SCREEN (plan-before-pay; Saxla same-block unfinished redispatch + modal №; close or cancel asks to save (blue saves and closes, gray discards and closes, question X returns); daily cap from the package cell (empty = 1), paid extras do not spend it; full stay can ask for checkout morning until 12:00; massage line can name one masseur; over-quota lab/visit is a paid `LabOrder`/`Visit` (not a procedure cheque row; in-quota lab stays a lab order); OPEN unpaid day-bucket; Pay/settlement keeps OPEN pin; nurse red block only if seated; day-end `UNPAID_MISSED`; cheque list is room or name, not the earliest 200, and hides days before today; leftover `*_POOL` not burn on Save/replace/plus; unseated package PROPOSED is off the day chip ("not seated"); UAT open — not SHOW) |
| Walk-in groups (CLI-61) | `/sanatorium/walk-in-parties` list + ModalShell CRUD | 🟡 SCREEN (empty selects; sticky doctor; physio on procedure; line grid + Eye; no journal in ops modal; hotel pending basket with `revenueCode`; UAT §11a open — not SHOW) |
| Open attendance (CLI-62) | Admin type checkbox; plan/print label; `/nurse` seat-on-arrival; `/sanatorium/resources` foresight; settings SAME_DAY | 🟡 SCREEN (day-bucket + SAME_DAY; `prescribeExtras` OPEN pins stay days; Pay keeps pin; UAT §11b open — not SHOW / not Pilot) |
| Mutation audit (CLI-19) | `/admin/audit` + `GET /api/admin/audit` (CatalogField incl. ClinicReceipt/ClinicShift; nav Mutation audit en/az/ru) | 🟡 SCREEN/SHIPPED viewer — Layer A + Wave B cashier SETTLE/VOID + shift + Wave E compound index (2026-10-29); HTTP_MUTATION UAT open; hash-chain deferred. Does not move Gate, Demo, Pilot, or Sell |

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off. TTK is documented only — does not change sell (still do not claim GA). CLI-55 episode-course card is **SCREEN** (built; UAT open) — not SHOW / not Pilot. CLI-57 plan-before-pay is **SCREEN** on the same row: it does not lift UI, Demo, or Pilot. Paid diagnostics from the episode (2026-11-01) stays **SCREEN** on Lab + CLI-57 rows — same rule. CLI-61 walk-in groups are **SCREEN** on the same rule. CLI-62 open attendance is **SCREEN** on the same rule. CLI-64 patient assignment ledger is **SCREEN** on the same rule (print included; not SHOW / not Pilot). Line rollup stays 🟡 (worst of Gate ✅, BE ✅, UI 🟡, Demo 🟡, Pilot open → edition `mvp`).

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
