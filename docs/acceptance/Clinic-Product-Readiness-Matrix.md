# Clinic — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Closeout (2026-11-10 procedure card stepper):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. Plus and minus stay on a procedure card after sessions are done. Minus stops at the done count. Lab extras stay off this modal. Bath and paraffin replacement asks for 7 characters and names the source line. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-10 lab journal groups):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-12 stays SHIPPED. Grouping does not lift Demo or Pilot. A patient can still split across pages. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-10 lane gates):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-55 stays SCREEN. Labs and visits follow their own checkboxes. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy and migration `20261110120000_lane_gate_json`.

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/clinic.yaml`](../editions/clinic.yaml)

**Closeout (2026-11-10 bonus roster):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The bonus page is the period table; rates and the chosen staff open from Settings. Does not lift Demo or Pilot. `clinic.yaml` untouched.

**Closeout (2026-11-09 bonus schedule):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-53 stays SCREEN. Bonus calculation is `/reports/bonus`. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy and migration `20261109180000_bonus_schedule_json`.

**Closeout (2026-11-09 checkout edge + closed course file):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 and CLI-55 stay SCREEN. Paid cabin extras stop the day before checkout. A closed course shows what was delivered, not the forward plan. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 stay-day past pink):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. Past working days on the procedure grid are pale pink. Non-working days stay gray. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 urine plus grades):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-32 stays SHIPPED. Same lab blank. No Demo or Pilot lift. `clinic.yaml` untouched. Droplet overlay applied and the clinic process restarted.

**Closeout (2026-11-09 checkout leaves the lab journal):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Checked-out guests leave the lab journal, nurse sheet, cabin grid, open-attendance queue, and cashier. The night no-show sweep skips them. Completed labs stay on the card. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 in-house reservation on pay):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Cashier pay fills a missing reservation from the episode. Word unpaid copy is translated. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 staff Word blank):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Staff Word upload follows the lab journal gate. Guest print stays closed until payment. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 paid lab repeat):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-12 stays SHIPPED. A paid repeat after a completed package lab stays. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 infect biochem own blank):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The intake date moves from package blood biochemistry to infection biochemistry. Other package labs that already had a window keep theirs. Saving it still cancels the open in-house order. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy and migration `20261109140000_infect_biochem_own_blank`.

**Closeout (2026-11-09 seating save):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 and CLI-62 stay SCREEN. CLI-26 stays SHIPPED. The procedure modal asks the start hour, holds paid misses for the checkout morning, and cuts only the latest future session. No-show quota is a clinic switch, default on. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy and migration `20261109120000_no_show_burns_quota`.

**Closeout (2026-11-09 urine salts list):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-32 stays SHIPPED. Duzlar gains 12 crystal choices beside Yoxdur. Does not lift Demo or Pilot. `clinic.yaml` untouched. Overlay applied on the Nafta clinic droplet; clinic process restarted.

**Closeout (2026-11-09 bath series second pass):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Elective visits use the clinic week. Recalc continues the seated bath block. CLI-05 stays SHIPPED. CLI-58 stays SCREEN. Does not lift Demo or Pilot. `clinic.yaml` untouched.

**Closeout (2026-11-09 bath series + clinic calendar):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-58 and CLI-59 stay SCREEN. Country holidays do not close a clinic day. A new bath batch continues the seated block. One bath regime stays one package card. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-09 stay-day grid chrome):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. The procedure modal keeps a fixed height. The date grid is sized for 23 days. The month name sits over its days. The split is 40% assign / 60% grid. Saturday is not gray. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 episode card chrome):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-55 stays SCREEN. Add sits above the doctor legend boxes. Tab-row icons cover Diaqnostika, Plan, and İcra planı. Seated plan rows show name, time, code, and regime (blank when there is none). An unseated row has no clock. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 stay-day grid):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. The procedure modal shows where saved sessions landed. Quota drops only for a session that has a date. Opening the modal again returns a session that still has no day. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 checkout horizon + catalog search):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 and CLI-62 stay SCREEN. Checkout day is consent for every procedure. Catalog search on the two assign modals matches the row name or the group title. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-07 Sollyuks cabin repair):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Droplet orders only. `restore-sollyuks-type.sql` and the twin remap removed. CLI-26 stays SHIPPED. No Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-07 urine color and clarity lists):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-32 stays SHIPPED. Closed lists only; no Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-06 working-hours admin API map, second pass):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-59 stays SCREEN. Schedule chip error banner + page-route exact map; no Demo/Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 working-hours admin API map):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-59 stays SCREEN (not SHOW). Calendar/peaks load under `screen:admin.settings`; bulk recalc/reseat stay platform SA. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 diagnostic modality save + create default):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-32 SHIPPED deepen: edit save keeps Modality (`formRef`); second-pass extends functional/`formRef` to modality, category, and analyte editors. Create defaults LAB for lab panel. Droplet `LAB-GLU`→LAB. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-07 matrix queue label):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-62 stays SCREEN. Band text is larger; only the first cabin repeats the full counts. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 second-pass OPEN-first + lab omit):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-62 stays SCREEN; CLI-34 SHIPPED deepen. Episode summary + card `mergeDays` keep OPEN-first; ADR print forms synced. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 lab print omit empty):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-34 SHIPPED deepen: lab blank drops empty/dash/echo rows and renumbers. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 open-attendance matrix bands):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-62 stays SCREEN (UAT §11b open → not SHOW). The resource matrix shows the open-attendance queue as morning and afternoon bands. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 OPEN-first day sort):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-62 stays SCREEN (UAT §11b open → not SHOW). Plan/print/nurse list OPEN unseated first that day. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-09 episode card boxes):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-55 stays SCREEN. One course on the card (Personal + Course legend boxes; edit on the Personal legend). Other courses stay under the patient row. An empty expand stays on that row. Does not lift Demo or Pilot. `clinic.yaml` untouched. Image `dev-c4224ee` deployed.

**Closeout (2026-11-08 regime cards):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. Same regime is one card (package count and paid count). A different regime is another card. Done sessions stay as a count. OPEN movable sessions reseat in card order. Minus and a paid draft stay on that regime. Lab and visit rows in the procedure modal keep their own lane. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 failed Saxla leaves no plan draft):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. A failed save deletes unseated package drafts, restores lifted seats, and returns the seat reason (anamnesis included). Checkout-morning seating and a masseur reseat delete rows that stay unseated. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 day-1 package night toasts):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. CLI-57 stays SCREEN. Clearer error toasts when stay nights are below package min or the template is missing. Does not lift Demo or Pilot. Hotel FO nights validation still open debt. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 extra-tickets OPEN-only):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Extra tickets desk stays SHOW; CLI-57 stays SCREEN. Checked-out guests hidden on every scope. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 working hours second pass):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Working-hours kit polish; Settings day chip → link only. Still SCREEN, not SHOW. Does not lift Demo or Pilot. `clinic.yaml` untouched.

**Closeout (2026-11-05 working hours + peak journal):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. New `/admin/working-hours` (Schedule / Day calendar / Peaks). Matrix outside hours darkened like lunch. Does not lift Demo or Pilot. `clinic.yaml` untouched. Needs migrate + image deploy.

**Closeout (2026-11-05 execution-plan chip):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The guest-card package chip is labeled İcra planı / План исполнения / Execution plan. Study fulfillment scales sit on that chip with the procedure scales. Diagnostics keeps assign, the intake list, and results. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 infection note parentheses):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Same lab blank. The boxed note drops the parenthetical method names. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 extra tickets date pickers):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Same `/reception/extra-tickets` desk. Period filters are kit date pickers. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-05 catalog range is not a result):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Same lab blank. A copied range is an empty cell. No Demo or Pilot lift. `clinic.yaml` untouched. Needs image deploy.

**Closeout (2026-11-06 package DAILY_RATE quotas):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Admin wizard FIXED vs DAILY_RATE; dynamic nights × quotaPerNight + Sunday + dailyUseCap; open-course recalc preview. CLI-51 stays SCREEN. AC-CLI-SAN-QUOTA stays 🟡. No Demo or Pilot lift. `clinic.yaml` untouched. Needs migrate + image deploy.

**Closeout (2026-11-07 per-block dynamic quotas):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Per-block `blockQuotaMode` DAILY_RATE (ceil fractional rate) \| WEEKLY \| PER_STAY; no KNOTS mode; FIXED = legacy knots until publish; SatAdmin cutover rates panel on FIXED before publish-daily. CLI-51 stays SCREEN. AC-CLI-SAN-QUOTA stays 🟡. No Demo/Pilot/edition lift. `clinic.yaml` untouched (`pilot_ready: false`). Needs migrate + image deploy + ops publish-daily with agreed rates.

**Closeout (2026-11-05 infection card note + diagnostics row):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Same lab print and the same diagnostics modal. The note and the row order wait for the image. No Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-05 extra tickets keep today's paid rows):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The default extra-tickets desk still lists unpaid rows and also keeps procedures, labs, and visits scheduled today that are already paid, with the hotel in-house amber row. Pay and cancel stay on unpaid due and overdue rows. A mixed patient total is the unpaid sum; an all-paid group total is those amber rows. Columns are Appointment and Payment. No new screen. No Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-05 package biochem own blank):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The own-blank control is the existing course list, not a new screen. The 30-day window is on the clinic droplet. The list shows it after the image deploy. No Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-05 auto block members):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Auto package labs and visits book catalog members, not the quota key. Open courses on the clinic droplet were repaired; the clinic image still has the old resolver until deploy. No new screen. No Demo or Pilot lift. `clinic.yaml` untouched.

**Closeout (2026-11-05 package-only catalog map):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Guest card keeps the package-only flag; lab picker and walk-in hide those rows. Live image still shows the four biochem panels until this map ships. `clinic.yaml` untouched. No Demo or Pilot lift.

**Closeout (2026-11-05 droplet package-only biochem):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. The four biochem panels are package-only in the DB. The running guest card still lists them as extras because `clinic:master-72341e9` has no `packageOnly` filter. `clinic.yaml` untouched. No Demo or Pilot lift.

**Closeout (2026-11-05 blank Tarix + serology options):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index notes the single issue date. Serology options are on the clinic droplet DB; the single Tarix line waits for the image. `clinic.yaml` untouched. No Demo or Pilot lift.

**Closeout (2026-11-05 paid lab on episode open):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched. The contour checkbox is removed from procedure and lab cards and no longer zeros an extra. A lab panel checkbox `autoPaidOnOpen` creates one priced order when the episode opens; the lab sees it before pay; the guest blank waits for payment; a package or finished order of the same code does not block the paid one; a missing price is a line on the episode and does not block the open; day-end and checkout leave that order until it is paid or cancelled. No new screen. No Demo or Pilot lift.

**Closeout (2026-11-05 diagnostic catalog active / package-only / categories):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Existing catalog screens deepen. An inactive category leaves pickers and keeps order titles. Does not lift Demo or Pilot.

**Closeout (2026-11-05 own lab blank, second pass):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched. Assign refuses a lab the fresh blank already covers, and saving the blank drops an uncollected order. No Demo or Pilot lift.

**Closeout (2026-11-05 own lab blank):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched. A catalog day count shows a checkbox and blank date on that intake row only. A fresh blank skips the in-house order. Nafta data sets 30 days on `LAB-INFECT`. No Demo or Pilot lift.

**Closeout (2026-11-05 droplet route axes):** Migration `20261105010000_service_route_axes` is on the clinic droplet. Procedure categories 75 PHYSIO / 10 BATH / 4 PARAFFIN. Menu surfaces 110 LAB / 86 DIAGNOSTIC / 14 VISIT match modality kind. Three BATH rows are name collisions (`SVC-NAFTALAN-APLIKASIYA`, `SVC-NAFTALAN-APLIKASIYA-KISI`, `SVC-ULTRAFONOFOREZ-YAG`) and stay for a card edit. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched.

**Closeout (2026-11-05 settings chips + service route axes):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched. Settings are the same keys, grouped into chips. Package route, block category, guest/internal contour, diagnostic menu surface, and diagnostic slot are catalog fields. They do not add a screen and do not lift Demo or Pilot.

**Closeout (2026-11-05 org payment methods):** Cashier consumes orch Sync catalog (CLI-33 deepen). Catalog SoR is Platform CP-PAY-METHODS-01 API. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `clinic.yaml` untouched.

**Closeout (2026-11-04 Nafta lab norms + second-pass):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Norm sentence + bound kind + sex/zones; catalog/lab editors; urine align + EXTERNAL/import; droplet overlay. Existing screens deepen only — not Demo/Pilot lift.

**Closeout (2026-11-04 Nafta lab blank norms wave):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Norm sentence + bound kind + sex pairs; catalog/lab editors; droplet overlay. Does not lift Demo or Pilot.

**Closeout (2026-11-04 Nafta lab blank norms):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Droplet catalog and saved lab results match the Word blanks. No new screen. Does not lift Demo or Pilot.

**Closeout (2026-11-03 extras draft + blank name):** Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/clinic.yaml` unchanged. Staging extra +/− until Saxla and printing the result-enterer name do not lift Demo or Pilot.

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
| Lab orders (q filter, Name (CODE), cancel ORDERED, repeat confirm) | `/lab-orders?lane=lab` and `?lane=diagnostic` + patient-card **Diagnostics** tab | 🟡 SCREEN (1-click select / 2-click open; lab-tech room filter via episode read; two list lanes (unlinked ECG/US/endoscopy stay on diagnostic); open duplicate of the same code blocked per patient; `AFTER_PAYMENT` services show on the lab lane before pay and stay off the guest blank until settled; reception day sheets at `/reception/nurse-sheets`; same order card; assign modal = package lanes + modality folders + Ödəniləcək; locked auto studies; package and study fulfillment scales sit on the execution-plan chip (İcra planı), not this tab; no Pay on card; Extra tickets hide CLOSED episodes; UAT open — not SHOW) |
| МКБ карточка пациента | `/patients/[id]` (after contraindications) | 🟡 |
| Nafta intake checklist (CLI-25/32/34) | `/patients/[id]` İlkin diaqnostik prosedurlar; `/print/checkup/[patientId]` 4 sections | 🟡 SCREEN (not WO `#33`; UAT open) |
| Nafta slots clock (CLI-25/48) | Card now/next + compact PLAN — Baku labels, `scheduledAt >= now` | 🟡 SCREEN (re-Apply `#23` required on droplet) |
| МКБ визит/стационар | `/visits/[id]`, `/inpatient` | 🟡 |
| Visit exam CPOE + print (CLI-10) | `/visits/[id]` CPOE; `/patients/[id]` exam notes; `/print/visit-exam/[id]` | ✅ SHOW (UAT-SMOKE punched; FHIR/whole-visit debt) |
| МКБ отчёт | `/reports/diagnoses` (меню Hesabatlar) | 🟡 (Fəsil `CatalogField`; chapter I/XIV `titleAz` short in catalog — droplet re-sync) |
| Пациенты по странам | `/reports/patients-by-country` | 🟡 SCREEN (CLI-56; UAT open) |
| ICD favorites admin | `/admin/icd-favorites` | 🟡 |
| SatAdmin catalogs | `/admin/*` | 🟡 |
| Working hours (CLI-59) | `/admin/working-hours` Schedule / Day calendar / Peaks | 🟡 SCREEN (settings permission loads schedule/calendar/peaks with load-error banners; SA-only bulk recalc/reseat; calendar + peaks do not reseat; a clinic day is the week template plus a manual override, not the country calendar; UAT open; not SHOW) |
| Cashier | `/cashier` | 🟡 |
| Print | `/print/*` | 🟡 — procedure, episode, and checkup dates render `дд.мм.гггг`. Guest procedure sheet can repeat name and note in `procedurePrintExtraLang` (lighter line; off by default). Lab/USM blanks: modality signer, then result author; one **Tarix** (issue date; draw date is not printed); a dash result has no norm on the blank or the order screen; **lab** blank omits empty/dash/echo rows and renumbers 1…N (not USM). Assigned studies list is `/print/studies`. Plan print and + sit on the day-chip row. Package start, practitioner dates, and same-day-until are `DatePicker` |
| Procedure TTK BOM (CLI-47) | `/admin/master-data` (procedure types) | 🟡 API (UAT sign-off open) |
| Physio sites S (CLI-49) | `/admin/physio-sites` (Unmatched); card chips + Solyuks/`NAFTALAN_FILL` + empty-catalog banner + PLAN site titles | 🟡 SCREEN (seed S then re-Apply `#23`; UAT open) |
| Extra tickets (Nafta dual-run) | `/reception/extra-tickets` + `/print/extra-ticket/[ticketId]` | ✅ SHOW (procedures + unpaid labs/visits Pay desk; only `OPEN` episodes — checked-out hidden in every scope; kind badge + title search; scope due by default keeps today's already-paid rows (amber, same as hotel in-house) with Appointment and Payment columns; overdue/noshow/issued/all with a kit `DatePicker` range; HOT-06 extension write still HEADLESS; not SHIPPED) |
| Local staff password (CLI-WF-PWD-01) | `/account/password` | 🟡 SCREEN (UAT listed; not SHOW / not GA) |
| Doctor first-day confirm (CLI-52 / Wave C) | `/sanatorium` + card proposed; `/admin/settings` scheduling mode | 🟡 SCREEN (no Confirm all; FIFO kept; UAT open; not SHIPPED) |
| Doctor bonus extras (CLI-53 / Wave D) | `/reports/procedures` fulfillment + doctor-bonus; `/reports/bonus` | 🟡 SCREEN (period table of HR-picked staff, share of the total before the name; settings modal; UAT open; not SHIPPED) |
| Paid revenue by code (CLI-63) | `/reports/revenue` | 🟡 SCREEN (paid extras, labs, exams; code resolved at read; UAT open; not SHIPPED) |
| Patient assignment ledger (CLI-64) | `/reports/patient-assignments` + `/print/patient-assignments/[episodeId]` | 🟡 SCREEN (one episode; procedures/labs/visits; room+kind; amount after acceptance; print; UAT open — not SHOW / not Pilot) |
| One stay two episodes (CLI-54 / Wave E) | `/sanatorium` multi-row same room | 🟡 SCREEN (same surname stays two rows; 1-click select / 2-click open Guest; nationality code, first doctor, hotel checkout; UAT open; not SHIPPED) |
| Episode as care course (CLI-55) | `/patients/[id]` one course: Personal + Course boxes; other courses on `/patients` | 🟡 SCREEN (built; in-house room change and stay-product room write the door on open episodes; UAT open — not SHOW / not Pilot) |
| Role access matrix (CLI-RBAC-01) | `/admin/access` | 🟡 SCREEN (Phase A + custom roles/seed; UAT listed; not SHOW / not Pilot) |
| Package/extras assign (CLI-57) | `/sanatorium` patient card Package + **Diagnostics** tabs + `/reception/extra-tickets` Pay | 🟡 SCREEN (plan-before-pay; failed Saxla, checkout-morning, and masseur reseat delete unseated drafts and name the reason; day-1 toasts for nights-below-min / template missing; extra +/− is draft until Saxla; cards split by regime (same regime keeps package and paid counts; done count stays on the card; seating fields and the naftalan quota alias do not open a second card); Saxla drops that regime's latest unfinished sessions and reseats movable OPEN rows in card order; bath Saxla walks the pinned day, then afternoon, then next-day morning; `seatMiss` on a moved pin; later Save uses the remembered hour or the current hour; package_assign audit startOn; auto LAB analyses+diagnostics stamp inPackage + day-1/GET heal within remaining; course create writes those auto labs and visits (episode open does not); procedure menu excludes labs/visits in API and modal; Diagnostics modality folders; package and study fulfillment scales only on the İcra planı chip; Extra tickets hide CLOSED episodes; UAT open — not SHOW). Fizio/special merge is applied on the clinic database; sell does not change |
| Walk-in groups (CLI-61) | `/sanatorium/walk-in-parties` list + ModalShell CRUD | 🟡 SCREEN (empty selects; sticky doctor; physio on procedure; line grid + Eye; no journal in ops modal; hotel pending basket with `revenueCode`; UAT §11a open — not SHOW) |
| Open attendance (CLI-62) | Admin type checkbox; plan/print/episode (OPEN first that day); `/nurse` seat-on-arrival; `/sanatorium/resources` morning/afternoon queue bands; settings SAME_DAY | 🟡 SCREEN (day-bucket + SAME_DAY; different OPEN codes share a day, same code once; OPEN unseated day-anchor excluded from FIXED restGap / overlap / compatibility; Pay keeps pin; OPEN-first day sort incl. `mergeDays`; matrix bands (full counts on the first cabin); UAT §11b open — not SHOW / not Pilot) |
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
