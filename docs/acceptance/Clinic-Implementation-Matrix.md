# Clinic — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**Closeout (2026-11-06 working-hours admin API map, second pass):** No new Scaffold ✅. AC-CLI-RBAC stays 🟡. Exact `ROUTE_PERMISSION_EXACT["/admin/working-hours"]`; schedule load-error UI; specs assert `schedule-recalc`/`schedule-reseat` unmapped; ADR + module-map SA-only note. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 working-hours admin API map):** No new Scaffold ✅. AC-CLI-RBAC stays 🟡 (out of BE). `clinic-days` / `peak-rules` added to `ADMIN_API_PREFIX_PERMISSIONS` → `screen:admin.settings`; inventory `scripts/audit-admin-api-map.mjs` + `__tests__/admin-api-prefix-inventory.spec.ts` + permission specs. Schedule recalc/reseat remain platform SA only (not settings). CLI-59 stays SCREEN. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 diagnostic modality save + create default):** AC-CLI-LAB stays ✅ (existing negative path). Service edit save used stale `setForm({...form})` and could drop Modality; fixed with `formRef` + functional updates. **Second-pass:** same pattern on modality / category / analyte editors + `saveAnalyte` reads `formRef`. Create still defaults Modality by Növ (`lab_panel`→LAB). Droplet `LAB-GLU` set to LAB. No new Scaffold ✅. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 second-pass OPEN-first + lab omit):** No new Scaffold ✅. AC-CLI-OPEN-ATTEND stays 🟡 — OPEN-first also on `/print/episode` and card `mergeDays` (Plan/History). AC-CLI-PRINT stays ✅ — ADR `clinic-print-forms` records lab omit-empty; USM unchanged. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 lab print omit empty):** AC-CLI-PRINT stays ✅ (existing missing-source negative path). Lab blank omits empty / dash / catalog-range-echo rows and renumbers 1…N (`omitEmptyLabPrintValue`; `__tests__/print-lab-omit-empty.spec.ts`). USM unchanged. No new Scaffold ✅. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 open-attendance matrix bands):** No new Scaffold ✅. AC-CLI-OPEN-ATTEND stays 🟡 (out of BE). Resource matrix draws the day queue on the procedure cabins as a morning band and an afternoon band; waiting is the same on both, arrivals split at lunch start. Unit path `summarizeOpenAttendanceBands` in `__tests__/open-attendance.spec.ts`. UAT §11b still open — not Scaffold ✅. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 OPEN-first day sort):** No new Scaffold ✅. AC-CLI-OPEN-ATTEND stays 🟡 (out of BE). Plan/print/nurse/`groupDays` sort OPEN unseated first that civil day; unit path in `__tests__/open-attendance.spec.ts`. UAT §11b still open — not Scaffold ✅. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 day-1 package night toasts):** No new Scaffold ✅. AC-CLI-ASSIGN stays 🟡. Day-1 open maps `QuotaBelowMinError` → `PACKAGE_NIGHTS_BELOW_MIN` and missing template → `TEMPLATE_NOT_FOUND` with localized error toasts; toast key unit path `__tests__/day1-program-toast.spec.ts` (not a full AC negative suite). Hotel nights guard remains debt. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 extra-tickets OPEN-only):** No new Scaffold ✅. AC-CLI-ASSIGN stays 🟡. `/reception/extra-tickets` lists procedures/labs/visits only when the clinical episode is `OPEN` (every scope). Checked-out / CLOSED courses stay off the desk. No new negative suite. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 CP-CHANNELS second-pass):** Platform AC-CP-CHANNELS — `REVENUE_EVENT` assert before visit/procedure/lab COMPLETED (Finance) and hub visit settle-confirm. No new clinic Scaffold ✅; does not reopen AC-CLI-* ✅. Gate/Pilot/`clinic.yaml` untouched.

**Closeout (2026-11-05 working hours second pass):** No new Scaffold ✅. Settings no longer edits day/peak hours (link to working-hours). Appointments grid follows `listClinicDays`. AC-CLI-SAN/MD unchanged. CLI-59 stays SCREEN. Gate/Pilot unchanged. `clinic.yaml` untouched.

**Closeout (2026-11-05 working hours + peak journal):** No new Scaffold ✅. AC-CLI-SAN and AC-CLI-MD stay ✅ (window unit path `__tests__/procedure-day-window.spec.ts`; no new negative suite for calendar/peaks). CLI-59 stays SCREEN. Saving calendar or peaks does not reseat. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs migrate + image deploy.

**Closeout (2026-11-05 execution-plan chip):** No new Scaffold ✅. AC-CLI-ASSIGN stays 🟡. The package tab id is unchanged. Paid and unpaid study scales render on that tab. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 extra tickets date pickers):** No new Scaffold ✅. AC-CLI-ASSIGN stays 🟡. The extra-tickets period is kit `DatePicker` (`gg.aa.iiii`). The API still takes `YYYY-MM-DD`. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 catalog range is not a result):** No new Scaffold ✅. AC-CLI-PRINT stays ✅. A lab result that only repeats the catalog range (`0.9-5.0 #` on LYM# / MXD# / NEUT#) prints as a dash with no norm and no flag. The order screen does the same. A numeric result stays. No new negative suite beyond `lab-analyte-norms.spec.ts`. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 infection note parentheses):** AC-CLI-PRINT stays ✅. The boxed note no longer prints the method name in parentheses (az/ru/en). No new Scaffold ✅. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 infection card note + diagnostics row):** No new Scaffold ✅. AC-CLI-LAB stays ✅. AC-CLI-ASSIGN stays 🟡. The lab blank prints a boxed PCR note when the order has an express card analyte (HBsAg, HCV, syphilis). The diagnostics assigned row uses the procedure order: title and trash, package stepper, extra price beside the extra stepper. No new negative suite. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 auto block members):** No new Scaffold ✅. AC-CLI-ASSIGN stays 🟡. Auto lab and visit blocks book every catalog member of the block. The quota key is not a service code. On the clinic droplet, short auto quotas were raised to the member count (Premium USG 14, gyn/uro blocks 2), 20 open package orders whose code was not a catalog service were cancelled, and open courses were re-applied. Closed courses were left. Gate/Pilot unchanged. Sprint-Index S-23 notes the repair. `clinic.yaml` untouched.

**Closeout (2026-11-05 package biochem own blank):** No new Scaffold ✅. AC-CLI-LAB stays ✅. Standart, Premium, Derma, Detoks, and infect biochemistry accept a guest blank for 30 days. Saving the date cancels an ORDERED order stored as the panel or its quota key, so it is not billed. A block with no catalog member is not booked as the quota key. A quota key resolves to the panel on this course's template only. A fresh blank is not recreated as a paid open lab. No new negative suite. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy; the day count is already on the clinic droplet.

**Closeout (2026-11-05 package-only catalog map):** AC-CLI-LAB stays ✅. Guest diagnostics modal now keeps `packageOnly` and `categoryActive`. `/lab-orders` and walk-in labs and visits omit `packageOnly` rows. The night master image already filtered; the map dropped the flag. No new negative suite. Gate/Pilot unchanged. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 droplet package-only biochem):** AC-CLI-LAB stays ✅. The four biochem panels are `package_only` in the clinic DB. Image `clinic:master-72341e9` guest card and lab-order picker do not filter that flag (`03cde3482` is on `dev`, not in this master image). No new negative suite. Gate/Pilot unchanged. `clinic.yaml` untouched.

**Closeout (2026-11-05 blank Tarix + serology options):** AC-CLI-PRINT stays ✅. Lab and USM blanks print one **Tarix** (issue date; print code waits for image deploy). HBsAg, HCV/`Anti-HCV`, and RPR gain `WEAK_POSITIVE` in `lab-blank-norms.json`. That overlay is on the clinic droplet DB. No new negative suite. Gate/Pilot unchanged. Sprint-Index note only; `clinic.yaml` untouched.

**Closeout (2026-11-05 own lab blank, second pass):** Package assign of a lab already covered by a fresh blank returns 409 `BROUGHT_IN_ACCEPTED`. Saving the blank cancels an `ORDERED` lab for that code. No new negative suite, so this does not open Scaffold ✅. AC-CLI-LAB unchanged. Gate/Pilot unchanged.

**Closeout (2026-11-05 own lab blank):** No new Scaffold ✅. `DiagnosticService.broughtInMaxDays` and `EpisodeBroughtInResult`. Stale or future dates return 400. Auto-apply skips a fresh blank. AC-CLI-LAB stays as it was. Gate/Pilot unchanged. Sprint-Index and `clinic.yaml` untouched.

**Closeout (2026-11-05 droplet route axes):** Same migration applied on the clinic database. No new negative suite and no Scaffold ✅. The three naftalan-name BATH collisions are data, not an AC reopen. Gate/Pilot unchanged.

**Closeout (2026-11-05 paid lab on episode open):** No new Scaffold ✅. AC-CLI-LAB stays as it was. `autoPaidOnOpen` on a lab panel creates one `forcePaid` order with `releaseAfterPay` and `autoPaidStay` at episode open. A package or finished order of the same code does not block the paid one; an open non-package order does. Missing price is recorded and does not fail the open. `closeUnpaidDiagnostics` skips `autoPaidStay`. Contour no longer zeros extras. No new negative suite. Gate/Pilot unchanged.

**Closeout (2026-11-05 settings chips + service route axes):** No new Scaffold ✅. AC-CLI-LAB and AC-CLI-ASSIGN stay as they were. An explicit package route is stored only when `fulfillmentExplicit` is set; older lab/exam rows still follow kind. Menu surface overrides the diagnostic lane when set. No new negative suite for these axes. Gate/Pilot unchanged. Sprint-Index and `clinic.yaml` untouched.

**Org payment methods Sync (2026-11-05):** Cashier settle modal reads `GET /api/payment-methods`; LOCAL settle asserts enabled codes. SoR is Platform AC-CP-PAY-METHODS 🟡 (out of BE rollup). Does **not** reopen any Clinic Scaffold ✅; Pilot `[ ]`; Sprint-Index and `clinic.yaml` untouched.

**Closeout (2026-11-04 guest blank after pay + reception day sheets):** AC-CLI-LAB stays ✅ (pay-gate negative path: lab and the staff patient card work `releaseAfterPay`, guest blank and course print stay closed). AC-CLI-ASSIGN stays 🟡. Gate/Pilot unchanged. The switch is `DiagnosticService.guestBlankRelease`, not a service code.

**Closeout (2026-11-04 open lab duplicate + diagnostic lane):** AC-CLI-LAB stays ✅ (existing `lab-order-cancel` negative path; check is now per patient inside the create transaction; an older open order wins over a newer completed one; unlinked ECG/US/endoscopy leave the analyses lane — `lab-order-lane.spec.ts`). Gate/Pilot unchanged. Live duplicate cleanup not run.

**Closeout (2026-11-04 fizio + special pool script):** applied on the clinic droplet after dump `/root/era-clinic-2026-11-04.sql.gz`. Premium 54+54 → 108 and Derma 57+42 → 99 on `SVC_FIZIO_POOL`, daily cap 10. Detoks physio cap 10, quantity 49 (no special pool). Four open courses retargeted; no session cancelled by the script. AC-CLI-ASSIGN stays 🟡. Gate/Pilot unchanged.

**Closeout (2026-11-04 blank Tarix + dash):** AC-CLI-PRINT stays ✅. Lab and USM blanks label the two dates **Tarix** (draw, then result). A dash result keeps no norm and no flag on the blank and on the order screen. An empty cell still shows the catalog norm while it is being filled. Gate/Pilot unchanged.

**Closeout (2026-11-04 lab/USM blank signer + dates):** AC-CLI-PRINT stays ✅. Modality signer and sample/result dates are on the existing blanks, not a new AC. Gate/Pilot unchanged.

**Closeout (2026-11-02 print extra language + lab rooms):** AC-CLI-LAB stays ✅ (room numbers return for episode-read without a practitioner; existing negative path). CLI-34 print extra language is a branding option on the existing guest sheet, not a new AC. Gate/Pilot unchanged.

**Closeout (2026-11-03 extras draft + blank performer):** AC-CLI-ASSIGN and AC-CLI-OPEN-ATTEND stay 🟡 (draft +/− until Saxla; tail drop + OPEN repack from today; no new negative spec, not Scaffold ✅). AC-CLI-PRINT stays ✅ (performer name on lab/USM uses the existing missing-source path). Gate/Pilot unchanged.

**Closeout (2026-11-03 yesterday start + diagnostics print):** AC-CLI-ASSIGN stays 🟡 (yesterday only when the course has no seated procedures; older dates and later saves snap to today; yesterday rows stored `COMPLETED`; no new negative spec, not Scaffold ✅). AC-CLI-PRINT stays ✅ (studies list includes package and payable visits; existing missing-source negative path). Gate/Pilot unchanged.

**Closeout (2026-11-02 nurse list + lab clicks):** AC-CLI-OPS stays ✅ (nurse day list and `/print/nurse-day` are the same CLI-26 board; existing negative path; no Scaffold reopen). AC-CLI-LAB stays ✅ (grid click + `LAB_TECH` episode read for the room filter; existing lab negative path). Gate/Pilot unchanged.

**BE deepen (2026-08-17):** Green Scaffold BE wave 5 — negative-path suites `__tests__/cli-*-negative.spec.ts`.

**Civil date labels (2026-10-30, display pass 2026-10-31):** Print sheets, episode labels, the patient stay date, and package-transfer dates render `дд.мм.гггг` via `bakuDateDisplay`. Package start, practitioner cycle anchor, exception date, and same-day-until use `DatePicker`. Pickers and the same-day API instant stay `YYYY-MM-DD` / noon UTC. No Scaffold ✅ / Pilot change.  
**Scope-cut:** AC-CLI-LAB = lab orders ops (not live HL7). AC-CLI-CASH = cashier settle/ops (not live KKM). HL7 CLI-23 + fiscal CLI-24 = External residual (like Hotel HOT-02).

**Stay reconcile (2026-11-02):** lost hotel lifecycle events are retried from the hotel outbox. The clinic pass at 06:00 and 18:00 Asia/Baku opens a missing in-house course, closes a checked-out or departed guest, and copies package, room, name, sex, and birth date. Does **not** lift AC-CLI-SAN-PAX or AC-CLI-EPISODE off 🟡. CLI-54 stays SCREEN.

**In-house room on the course (2026-10-30):** `handleRoomChanged` and `handleStayProductChanged` write `roomNumber` on every OPEN episode of the reservation and on in-progress visits. The card move already publishes `ROOM_CHANGED` through relocate; an in-house schedule room change publishes the same event. Does **not** lift AC-CLI-EPISODE off 🟡. CLI-55 stays SCREEN.

**Package / OPEN / home deepen (2026-10-30):** `prescribeExtras` OPEN day-buckets across stay; Saxla unseats unfinished same daily-cap block and reseats with new lines; package modal № 1…N; `/` + executive `from`/`to`; sanatorium arrival column; diagnoses Fəsil `CatalogField`; ICD chapter I/XIV `titleAz` short. **Second-pass:** Pay / walk-in settlement keeps OPEN day-bucket (no re-pin); list sort `arrival`; home copy range-neutral. Does **not** lift AC-CLI-ASSIGN / AC-CLI-OPEN-ATTEND off 🟡. CLI-57 / CLI-62 stay SCREEN.

**Paid diagnostics from episode (2026-11-01):** over-quota lab/imaging/visit → `LabOrder`/`Visit` + folio/settlement keys `lab-ticket-`/`visit-ticket-`; unpaid priced rows off `/lab-orders` until `settledAt`. Diagnostics tab SCREEN. **Second-pass:** GET/`publish`/`complete`/`blank`/print refuse unpaid; package `extras-prescribe` merges pending diagnostics for list/delete; walk-in lab `forcePaid`. **UX polish:** kit `Field` time + date-only visit stamp; Baku draft; Lab/Visit i18n; walk-in extras +. **Card UX (amended):** package burns always `amountNet=0` + heal; pending = real paid only; Diagnostics modal = Package lanes (**assignedStudies** locked, group accordion, Ödəniləcək; **without Pay**); Paket/Diaqnostika **red unpaid scales** → blue merge after Pay; pay desk `/reception/extra-tickets` (labs+visits; kind badge; title search; MIXED_PATIENT; **2026-11-05** list scope due/overdue/noshow/issued/all — pay and cancel only due and overdue; the due desk also keeps today's already-paid rows (amber) with Appointment and Payment columns; completed with no cheque and zero-amount rows stay out of those two; inverted dates ask for a period); `QUOTA_REMAINING`; intake prefers inPackage. **Visit pay-gate:** unpaid priced visits refuse complete/CPOE/diagnosis/Rx (`visit-pay-gate.spec.ts`). Does **not** demote AC-CLI-LAB ops Scaffold ✅; does **not** lift AC-CLI-ASSIGN off 🟡. Gate / Pilot / edition unchanged.

**Patient assignment ledger (2026-11-01, CLI-64):** `/reports/patient-assignments` + print — one episode; procedures/labs/visits; room+kind filters; amount after payment acceptance. **Second-pass:** print RBAC mapped; room options stable under filter; empty visit lines ≠ inPackage (`visitLinesAreInPackage`). SCREEN. AC-CLI-ASSIGN-LEDGER 🟡 out of BE rollup. Gate / Pilot / edition unchanged.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CLI-MD | Master data (practitioners, rooms, resources, procedure types) | ✅ | [ ] | `__tests__/cli-md-negative.spec.ts` + CLI-01..04,30,36,38 | Negative: module gate; inactive practitioner / catalog |
| AC-CLI-OPS | Appointments + day-ops + reception queue | ✅ | [ ] | `__tests__/cli-ops-negative.spec.ts` + CLI-05,14,26,29 | Negative: module gate 403; cancel COMPLETED; reschedule deny. 2026-10-29 matrix `receptionProcedureCheckIn` + nurse unpaid Late; 2026-10-30 home/executive `from`/`to` (no Həkim) = SHIPPED deepen — does not reopen Scaffold |
| AC-CLI-PT | Patients / clinical card / demographics | ✅ | [ ] | `__tests__/cli-pt-negative.spec.ts` + CLI-06,25,28,40 | Negative: module gate; MDM identifier (FIN or passport+country, not phone); name parts to MDM; visit diagnoses CLI-40; card ICD without open episode. Anamnesis gate moved to episode (CLI-55) — demographics PATCH no longer requires it |
| AC-CLI-LAB | Lab orders ops + diagnostic catalog | ✅ | [ ] | `__tests__/cli-lab-negative.spec.ts` + `__tests__/lab-order-pay-gate.spec.ts` + `__tests__/diagnostics-ticket-refs.spec.ts` + `__tests__/diagnostics-schedule.spec.ts` + `__tests__/visit-pay-gate.spec.ts` + `__tests__/diagnostics-package-money.spec.ts` + `__tests__/package-auto-apply.spec.ts` + CLI-11,12,32 | **Ops only** — illegal publish / collect / complete; not live HL7. Catalog templates + Connect copy-if-empty (ADR clinic-catalog-template-overlay). **2026-11-01:** paid episode labs/imaging are `LabOrder`; unpaid priced hidden until `settledAt`; package burns amountNet 0; Diagnostics lanes + modality folders SCREEN (package quota scales off the Diagnostics tab; procedure menu filters `LAB_ORDER`/`VISIT` in API and modal; no Pay on card — Extra tickets; room filter hides CLOSED episodes; day-end/checkout/walk-in close cancel unpaid ORDERED labs and IN_PROGRESS visits); second-pass: hidden study burns via `studyBalances`; **2026-11-05:** service/modality Active on the edit card; category Active hides its services from assignment lists; `packageOnly` leaves the paid-extra and walk-in catalogs (four package biochem panels). An inactive category leaves pickers and keeps order titles. Not a new Scaffold ✅. **2026-11-02:** auto LAB analyses+diagnostics packageStamp + heal (assign GET + day-1 linkExisting; remaining quota; unit over-heal refuse); course create calls `applyPackageAutoBlocks` `CARE_TEAM` (episode open no longer does; no doctor creates labs and skips visits; second pass does not duplicate; `__tests__/package-auto-apply.spec.ts` + `__tests__/cli-san-negative.spec.ts`) — assign UI still SCREEN / UAT open — do not claim Pilot. **List lanes:** `GET /api/lab-orders?kinds=&unclassified=` splits analyses (`lab_panel` + no catalog service) from diagnostics (`imaging`/`functional`/`endoscopy`); package kind in neither (`__tests__/lab-order-lane.spec.ts`) |
| AC-CLI-SAN | Sanatorium chart + doctor-confirm FIFO | ✅ | [ ] | `__tests__/cli-san-negative.spec.ts` + CLI-13,31,38,39 | Negative: FIFO skip → 409; module gate; ICD empty/chapter reject (`__tests__/icd10-catalog.spec.ts`). 2026-10-30 `/sanatorium` arrival column + sort=`arrival`; **2026-11-02** 1-click select / 2-click open Guest = SHIPPED deepen — does not reopen Scaffold |
| AC-CLI-SAN-PKG | Staff assign 4 Nafta SKUs + episode without hotel program (Wave A) | 🟡 | [ ] | `cli-san-negative` unknown template; CLI-50 | **Out of AC-CLI-SAN rollup** — dual-run assign; do not flip SAN |
| AC-CLI-SAN-QUOTA | PDF knots + nights recalc + charge by quota (Wave B); DAILY_RATE per-block DAILY_RATE (ceil fractional) / WEEKLY / PER_STAY + Sunday + dailyUseCap; open-course recalc preview | 🟡 | [ ] | `__tests__/program-quota.spec.ts`; `__tests__/daily-rate-quota.spec.ts`; `__tests__/entitlement-usage.spec.ts`; CLI-51 | **Out of AC-CLI-SAN rollup** — W1: Lab/Visit burn via COUNT SoT. Scaffold stays 🟡 until PRD names both modes + negative path UAT. |
| AC-CLI-SAN-DAY1 | Doctor first-day 2–3 confirm; no Confirm all (Wave C) | 🟡 | [ ] | FIFO gates unchanged; CLI-52 | **Out of AC-CLI-SAN rollup** — does not reopen SAN ✅ |
| AC-CLI-ASSIGN | Package lazy-assign modal + plan-before-pay seating of unpaid extras (`PLAN_BEFORE_PAY`); Pay keeps the cabin (CLI-57) | 🟡 | [ ] | `__tests__/cli57-package-assign.spec.ts` + `package-assign-redispatch.spec.ts` | **Out of BE rollup** until UAT; SCREEN. 2026-10-30: Saxla same-block unfinished redispatch + modal №; OPEN unpaid extras day-bucket; Pay/settlement keeps OPEN pin. Leftover `*_POOL` picker unit only. Massage line can name one masseur. **2026-11-01:** unseated package PROPOSED blocks same-code that Baku day; over-quota lab/visit → paid `LabOrder`/`Visit`; Diagnostics = package lanes (**assignedStudies** lock, accordion, Ödəniləcək; **without Pay**); package quota scales stay off Diaqnostika; procedure menu is `PROCEDURE_ORDER` in the API and the modal; hidden LAB/VISIT burns via `studyBalances` (not `NOT_IN_PROCEDURES`); `QUOTA_REMAINING` — not Scaffold ✅. **2026-11-02:** pinned bath day walks slot-by-slot (`day_full` / `same_day` / `no_staff` / `closed` do not leave the day); afternoon retry only after that pass; `seatMiss` + audit `searchHour`; later Save and masseur reseat use remembered hour or current hour (null audit `startHour` does not reset it) (`saxlaRepeatClock`, `__tests__/clinic-day-next-working.spec.ts`) — not Scaffold ✅. Prior: bath pin miss → afternoon then next-day morning+afternoon; package_assign audit `startOn`/`startHour`; auto LAB analyses+diagnostics stamp inPackage + studyBalances heal (day-1 linkExisting + remaining quota; package-assign LAB `packageStamp`) — not Scaffold ✅. Start date is `DatePicker` only — stays 🟡. **2026-11-06:** a failed Saxla deletes unseated package drafts and restores lifted seats; checkout-morning and masseur reseat delete rows that stay unseated; anamnesis is a `misses` reason; `INSTANTIATE_FAILED` keeps the original message; `package_assign_failed` is audited. The plan does not list unseated package `PROPOSED`. Not Scaffold ✅ |
| AC-CLI-BONUS | Doctor bonus extras-only buckets (Wave D) | 🟡 | [ ] | `__tests__/extra-prescriber.spec.ts` + `__tests__/cli-doctor-bonus.spec.ts`; CLI-53 | **Out of AC-CLI-SAN rollup.** Prescriber = acting doctor, else earliest episode care doctor. Fulfillment view counts package/extra assigned vs completed; amount is completed paid extras only. Unit-only — no field negative path; not Scaffold ✅ |
| AC-CLI-REV | Paid-fact revenue statement by resolved hotel revenue code (CLI-63) | 🟡 | [ ] | `__tests__/revenue-statement.spec.ts`; CLI-63 | **Out of Scaffold BE rollup.** Groups paid extras, settled/sent labs, and paid visit lines by `revenueCodeForServiceLine`. No fixed article list. Unit grouping only — no field negative path; not Scaffold ✅ |
| AC-CLI-ASSIGN-LEDGER | Patient/episode assignment ledger (CLI-64) | 🟡 | [ ] | `__tests__/patient-assignment-ledger.spec.ts` + `clinic-page-route-inventory` print map; CLI-64; ADR clinic-patient-assignment-ledger | **Out of Scaffold BE rollup.** SCREEN UI + print (`screen:reports.procedures`); unit amount/completion + empty-lines inPackage only — no field negative path; not Scaffold ✅ |
| AC-CLI-SAN-PAX | One stay two episodes (Wave E) | 🟡 | [ ] | CLI-54; openEpisode per patient; `__tests__/open-episode-stay-idempotency.spec.ts` same surname does not reuse a pax-scoped episode; `__tests__/guest-departed-moved.spec.ts` companion without MDM matches `::pax:` stay id; `__tests__/stay-reconcile-plan.spec.ts` missing guest opens, checked-out and departed close | **Out of AC-CLI-SAN rollup** — negative path is unit-only; field UAT open, Scaffold stays 🟡. 2026-11-02 list select/double-click and the stay reconcile do not lift it off 🟡 |
| AC-CLI-EPISODE | Episode as care course (card switcher, children, walk-in close) | 🟡 | [ ] | CLI-55; ADR clinic-episode-as-clinical-course; `__tests__/cli-episode-negative.spec.ts` + `cli-episode-gates.spec.ts` | **Out of BE rollup** until field UAT; SCREEN UI landed; Scaffold stays 🟡 |
| AC-CLI-WALKIN-PARTY | Walk-in groups list + ModalShell CRUD → one hotel cashier basket (CLI-61) | 🟡 | [ ] | CLI-61; ADR clinic-walk-in-party; `__tests__/walk-in-party.spec.ts` | **Out of BE rollup** until field UAT; SCREEN (physio on addLine, no journal in ops modal); send posts hotel `revenueCode` (same as cashier pending); unit placeholders only — no field negative path; not Scaffold ✅ |
| AC-CLI-OPEN-ATTEND | Open attendance day-bucket + SAME_DAY check-in + foresight (CLI-62) | 🟡 | [ ] | ADR clinic-open-attendance; `__tests__/open-attendance.spec.ts` + `procedure-slot-scan` OPEN restGap | **Out of BE rollup** until field UAT; SCREEN. 2026-10-30: `prescribeExtras` PLAN_BEFORE_PAY OPEN pins day-buckets to stay `endsOn`; Pay/settlement keeps pin (no re-walk). 2026-11-02: different OPEN codes share a day, same code once per working day, in-package block cap still applies, unpaid extra past stay is deleted (`no_slot`); **`orderCountsForWallClockRest`** — OPEN unseated day-anchor out of FIXED restGap / overlap / compatibility. **2026-11-06:** plan/print/nurse/`groupDays`/episode summary/`mergeDays` sort OPEN unseated **first** that civil day (`compareOpenUnseatedFirst`). Resource matrix queue is morning/afternoon cabin bands (`summarizeOpenAttendanceBands`); **2026-11-07** the band text is larger and only the first cabin of the procedure shows the full counts. Unit path only — not Scaffold ✅. 2026-10-31 same-day-until is `DatePicker` only — stays 🟡 |
| AC-CLI-RBAC | Configurable role×screen/API matrix + custom roles (Variant A) | 🟡 | [ ] | `cli-rbac-negative` + `cli-rbac-admin-negative` + `cli-rbac-ops-negative` + `clinic-system-roles` + staff-provision unknown role + `admin-api-prefix-inventory` (fail-closed map); ADR clinic-domain-permissions-and-rbac; `/admin/access` clone | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence. 2026-11-06 clinic-days/peak-rules mapped to settings — inventory only, not Scaffold ✅ |
| AC-CLI-CASH | Cashier settle / ops | ✅ | [ ] | `__tests__/cli-cash-negative.spec.ts` + CLI-33 | **Settle/ops only** — visit/shift deny; live fiscal = External |
| AC-CLI-PRINT | Print forms + branding | ✅ | [ ] | `__tests__/cli-print-negative.spec.ts` + CLI-34 | Negative: missing source; unsupported lang |
| AC-CLI-CAP | Clinic→hotel capacity foresight | ✅ | [ ] | `__tests__/cli-cap-negative.spec.ts` + CLI-27 | Negative: critical risk blocks booking |
| AC-CLI-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit fail-closed tenant extension; Wave 2 clinic login/JWT/`enterSatelliteTenant` + lifecycle ALS; Wave 4 cron + capacity POST multi-org; Wave 5 lab `saas-wave5-two-org-isolation`; Wave 9 live pool smoke; Wave 10 cron User DISTINCT discover | **Excluded from Scaffold BE rollup.** Lab + live-smoke + cron discover available; still not Scaffold ✅ (field two-org UAT open). Signoff: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md) |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-CLI-TENANT, AC-CLI-SAN-PKG, AC-CLI-SAN-QUOTA, AC-CLI-SAN-DAY1, AC-CLI-ASSIGN, AC-CLI-BONUS, AC-CLI-REV, AC-CLI-ASSIGN-LEDGER, AC-CLI-SAN-PAX, AC-CLI-EPISODE, AC-CLI-RBAC, AC-CLI-WALKIN-PARTY, AC-CLI-OPEN-ATTEND) → **✅**.
AC-CLI-TENANT is 🟡 (Nafta clinic placement is SHARED; schema+filter) and stays **out of Scaffold BE rollup** until field isolation UAT.
AC-CLI-SAN-PKG is 🟡 and stays **out of Scaffold BE rollup** (does not reopen AC-CLI-SAN).
AC-CLI-SAN-QUOTA is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-SAN-DAY1 is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-BONUS is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-REV is 🟡 (CLI-63 SCREEN; unit grouping only) and stays **out of Scaffold BE rollup**.
AC-CLI-ASSIGN-LEDGER is 🟡 (CLI-64 SCREEN; unit amount/completion helpers only) and stays **out of Scaffold BE rollup**.
AC-CLI-SAN-PAX is 🟡 and stays **out of Scaffold BE rollup**.
AC-CLI-ASSIGN is 🟡 (plan-before-pay seated; leftover-pool picker, replace, and plus are unit-tested only for the picker helper; UAT open; no field negative path) and stays **out of Scaffold BE rollup**.
AC-CLI-EPISODE is 🟡 (SCREEN landed; field UAT open) and stays **out of Scaffold BE rollup**.
AC-CLI-RBAC is 🟡 (Phase A shipped; field UAT open) and stays **out of Scaffold BE rollup**.
AC-CLI-WALKIN-PARTY is 🟡 (list+modal SCREEN; UAT §11a open) and stays **out of Scaffold BE rollup**.
AC-CLI-OPEN-ATTEND is 🟡 (CLI-62 SCREEN; UAT §11b open) and stays **out of Scaffold BE rollup**.
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CLI-LAB / CLI-23 | HL7 production adapter | External ⏸ | Scope-cut (like Hotel HOT-02) — not AC-CLI-LAB ops |
| AC-CLI-CASH / CLI-24 | Live fiscal KKM | External ⏸ | Scope-cut — not AC-CLI-CASH settle/ops |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| AC-CLI-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Wave 5 lab + Wave 9 live-smoke + Wave 10 cron discover; Scaffold ✅ still needs field pass |
| CLI-47 | Procedure TTK → Finance inventory | Out of BE plan | ADR `clinic-procedure-consumable-ttk`; API W1 (BOM+event); Finance write-off W2 |
| CLI-49 | Physio S + program/substance catalogs | Out of BE plan | Nafta card wave: Solyuks/`belinə`/`NAFTALAN_FILL`; empty-catalog UX; `#23` always `replaceSites`; satellite templates + copy-if-empty (ADR clinic-catalog-template-overlay); UAT open until droplet proof |
| CLI-32 / CLI-34 / CLI-25 | Nafta intake checklist + Baku slots | Out of BE plan | `PKG-NAFTA-INTAKE` card/print + live instantiate; `#23` `parseBakuDateTime(+04:00)` + PLAN/now `gte now` — UAT punch in `UAT-SMOKE.md`. 2026-11-04 lab norms (`normText*`/`boundKind`/sex; urine align; droplet script) deepen SHIPPED only — do not move Scaffold |
| Dual-run extra tickets | Nafta Elektraweb SPA outbox | Out of BE plan | `/reception/extra-tickets`; HOT-06 HEADLESS; Wave 9 field runbook [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md). Not Scaffold / not SHIPPED. |
| CLI-55 / AC-CLI-EPISODE | Episode as care course | Out of BE plan | ADR `clinic-episode-as-clinical-course`; SCREEN W1–W5; AC stays 🟡 until field UAT; do not reopen AC-CLI-PT demographics anamnesis |
| CLI-56 | Episode care team (multi-doctor) | Out of BE plan | ADR `clinic-episode-care-team`; SCREEN; assigned-only scope + card gate; appointments link deferred |
| CLI-57 | Package/extras assign + plan-before-pay | Out of BE plan | ADR `clinic-extra-procedure-route` + `clinic-paid-diagnostics-from-episode` + assign-modal leftover `*_POOL` off Save, replace, and plus; Saxla same-block redispatch + modal № (2026-10-30); close or cancel asks to save; blue saves and closes, gray discards and closes, question X returns; daily cap is the stored package cell (empty = 1), paid extras do not spend it; quota recalc and a new course cap per-night blocks by non-Sunday stay nights; checkout morning until 12:00 is a confirm for cabin procedures, not the default save; guest procedure print sorts by calendar date; a massage line can name one masseur (empty = automatic; package and paid share it; unstarted cabin sessions reseat; open attendance keeps the day); a lab block shows when the template checkbox is on; in-quota lab stays one lab order; over-quota lab/visit is a paid `LabOrder`/`Visit` (`NO_PRICE` refused); package `extras-prescribe` merges pending diagnostics; day-end cron (today seated + overdue + unseated before today); extra-tickets ask for room or name and omit days before today (2026-10-30); SCREEN; UAT open; unit passes for sweep/redispatch attach; no field negative path; not Scaffold ✅ |
| CLI-61 / AC-CLI-WALKIN-PARTY | Walk-in groups list + ModalShell | Out of BE plan | ADR `clinic-walk-in-party`; SCREEN; send stamps `revenueCode`; UAT §11a open; unit placeholders only; not Scaffold ✅ |
| CLI-62 / AC-CLI-OPEN-ATTEND | Open attendance + SAME_DAY window | Out of BE plan | ADR `clinic-open-attendance`; SCREEN; OPEN unpaid extras day-bucket pin + Pay keeps pin (2026-10-30); **2026-11-02** OPEN unseated day-anchor out of restGap / overlap / compatibility + share-day picker; **2026-11-06** OPEN unseated sorts first that day (`compareOpenUnseatedFirst`, incl. episode summary + card `mergeDays`); resource-matrix morning/afternoon queue bands; helper + slot-scan unit tests; code refuses OPEN DnD / SAME_DAY without cabin; UAT §11b open; not Scaffold ✅ |
| CLI-64 / AC-CLI-ASSIGN-LEDGER | Patient/episode assignment ledger | Out of BE plan | ADR `clinic-patient-assignment-ledger`; SCREEN `/reports/patient-assignments` + print RBAC; room options stable; empty visit lines ≠ inPackage; unit helpers only; UAT open; not Scaffold ✅ |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-clinic/__tests__/cli-ops-negative.spec.ts` | AC-CLI-OPS |
| `era-clinic/__tests__/cli-pt-negative.spec.ts` | AC-CLI-PT |
| `era-clinic/__tests__/cli-md-negative.spec.ts` | AC-CLI-MD |
| `era-clinic/__tests__/cli-san-negative.spec.ts` | AC-CLI-SAN |
| `era-clinic/__tests__/icd10-catalog.spec.ts` | AC-CLI-SAN (CLI-39) + AC-CLI-PT (CLI-40) selectable ICD |
| `era-clinic/__tests__/cli-lab-negative.spec.ts` | AC-CLI-LAB |
| `era-clinic/__tests__/lab-order-pay-gate.spec.ts` | AC-CLI-LAB (paid unpaid journal gate) |
| `era-clinic/__tests__/diagnostics-ticket-refs.spec.ts` | AC-CLI-LAB / AC-CLI-ASSIGN (lab/visit folio keys ≠ `clinic-ticket-`) |
| `era-clinic/__tests__/cli-print-negative.spec.ts` | AC-CLI-PRINT |
| `era-clinic/__tests__/print-lab-omit-empty.spec.ts` | AC-CLI-PRINT (lab blank omit empty/dash/echo) |
| `era-clinic/__tests__/cli-cap-negative.spec.ts` | AC-CLI-CAP |
| `era-clinic/__tests__/cli-cash-negative.spec.ts` | AC-CLI-CASH |
| `era-clinic/__tests__/cli-rbac-negative.spec.ts` | AC-CLI-RBAC (Wave 1) |
| `era-clinic/__tests__/cli-rbac-admin-negative.spec.ts` | AC-CLI-RBAC (Wave 2) |
| `era-clinic/__tests__/admin-api-prefix-inventory.spec.ts` | AC-CLI-RBAC (admin API map inventory) |
| `era-clinic/scripts/audit-admin-api-map.mjs` | AC-CLI-RBAC (assertClinicAdmin* ↔ ADMIN_API_PREFIX_PERMISSIONS) |
| `era-clinic/__tests__/cli-rbac-ops-negative.spec.ts` | AC-CLI-RBAC (Wave 3) |
| `era-clinic/__tests__/clinic-page-route-inventory.spec.ts` | AC-CLI-RBAC (Wave 3 page fail-closed) |
| `era-clinic/__tests__/clinic-system-roles.spec.ts` | AC-CLI-RBAC (system seed + custom role model) |
| `era-clinic/__tests__/clinic-role-admin.spec.ts` | AC-CLI-RBAC (create/delete/staffKind/assign API rules) |
