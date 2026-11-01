# Hotel — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Night-audit enqueue (2026-10-31):** orchestrator queue id no longer rejects `hotel-na:YYYY-MM-DD`. Not a new AC row and not Scaffold ✅. HOT-NA-01 stays SHIPPED. Does not change the BE rollup.

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-04):** Negative-path suites landed — `__tests__/p5-fo-money-negative.spec.ts`, `fo-gates-negative.spec.ts`, `mdm-negative.spec.ts`, `hk-status-negative.spec.ts`. A settlement line with method DEPOSIT is refused (`DEPOSIT_INTAKE_CLOSED`). Old HELD rows move once onto a blue room payment. That does not add a Scaffold ✅ and does not change AC-HOT-CASH, which stays ✅ on the existing negative path. Pilot-ready stays open.

**CL closeout (2026-10-27):** `transfer-guest-to-payer.spec.ts` covers `NO_PAYER_ON_STAY` / company-prefer / agency fallback. Second-pass: shell Front Cash CL nav, unsettled Folio card, undo keeps settlement when AR remains. AC-HOT-CASH Scaffold ✅ unchanged (negatives present). Pilot-ready still `[ ]`.

**CL ledger audit (2026-10-28):** Code review of `/front-cash/agency-ledger` + `/front-cash/company-ledger` — statement/opening from AGENCY/COMPANY folios (full history); guest-pocket stays excluded until routing/MOVE_PAYER; settle POST 409 Finance-only. HOT-CL-06 back on COVERAGE. **No new negatives required** — existing `front-cash-b2b-folios` + p5/transfer suites cover split + CL gate. AC-HOT-CASH Scaffold ✅ / Pilot-ready `[ ]` unchanged.

**Agency commission payable (2026-10-29):** ADR hotel-agency-commission-payable; `AgencyCommissionLine`/`Batch`; hub `/distribution/agency-commission`; Finance snapshot + CP card + purchase `hotelCommissionBatchId` + offset. Negatives: `__tests__/agency-commission.spec.ts` (GROSS/NET/split). Submit fails closed on event error. **AC-HOT-AG-COMM 🟡** out of Scaffold BE rollup (UAT §27c open). Does **not** reopen AC-HOT-CASH ✅; Pilot-ready still `[ ]`.

**Overbook caps (2026-10-31):** Sellable nights use `baseQuota` plus a per-type allowance and one house allowance, both default 0. Stop-sell still zeros the night. `__tests__/inventory-caps.spec.ts` plus the Avl=0 case in `fo-gates-negative.spec.ts`. A per-date allowance is not in this edition. Does **not** reopen AC-HOT-FO Scaffold ✅; Pilot-ready still `[ ]`.

**CashShift ensure (2026-10-28):** Folio CASH/CARD, deposit payout, and settlement pending/basket share `ensureOpenCashShift` (unit `__tests__/cash-shift-ensure.spec.ts`). Second-pass: NA status + front-cash journal read via `findOpenCashShift`; module-map basket/pay + `/api/cash/shifts`. Does not reopen AC-HOT-CASH Scaffold ✅; Pilot-ready still `[ ]`.

**NA stop refs (2026-10-28):** Preview `refs` + `/night-audit` Open reservation on folio/price/due/arrival stops; run errors include reservation id. **No new AC row** — HOT-NA-01/02 COVERAGE SHIPPED deepen. Does **not** reopen AC-HOT-CASH Scaffold ✅; Pilot-ready still `[ ]`.

**Pending revenueCode (2026-10-28):** Hub `createPendingCharge` + Zod refuse non-zero amount without `revenueCode`; idempotent retry may heal a blank row; clinic walk-in/extras + F&B defer resolve codes; NA fails early with `sourceSystem:sourceRef` (no invented `UNKNOWN`). HOT-CASH-02 / HOT-NA-01 SHIPPED deepen; AC-HOT-REV stays 🟡 out of rollup. Does **not** reopen AC-HOT-CASH Scaffold ✅; Pilot-ready still `[ ]`.

**Finance→Hotel payment apply (2026-10-27):** HOT-CL-07 API — allocate + bank match → hotel `payment-applied` via outbox/reconcile; peer URL from SatelliteEndpoint (ADR satellite-peer-url-resolution). Does not reopen AC-HOT-CASH Scaffold; Pilot unchanged.

**Room payer / commission basis (2026-10-27):** `Reservation.roomPayer` + `commissionBasis`, contract `commissionBasis`, card strip, mid-stay `COMMERCIAL_AMEND_REQUIRED`. ADR hotel-room-payer-and-commission-basis. Does not reopen AC-HOT-CASH Scaffold or Pilot.

**FO contract leftovers (2026-10-27):** `defaultsFromSalesContract` (corp→COMPANY); mandatory-contract hint + B2B link; `GET /api/fo/sellable?salesContractId=` allotment preview; API code→toast for payer/contract required. Second-pass: allotment-exhausted → 409 + create/group toasts. Negatives already on AC-HOT-CASH (`CONTRACT_REQUIRED_FOR_PAYER` path + room-payer policy). Scaffold ✅ / Pilot unchanged.

**B2B contracts UI honesty (2026-10-27):** `/distribution/contracts` icon row actions (Cancel/Expire); no silent `AGENCY` default; create requires `counterpartyType` + `companyId` for CORPORATE; list `companyId`; hide decorative minStay/CTA/CTD/deposit (ADR Open debts SC-REST/DEP/REL). Status transition negatives: `__tests__/sales-contract-status.spec.ts`. Second-pass: EXPIRED/CANCELLED → notes/`externalRef` only; allotment upsert/delete 400; create-block hidden. **No new AC row** — HOT-AG-01 COVERAGE SHIPPED; does **not** reopen AC-HOT-CASH Scaffold ✅ or Pilot.

**Civil date labels (2026-10-30, display pass 2026-10-31):** Ops tables, the night-audit banner, city-ledger dates, the guest-list birth date, the reservation card, guest CRM, and tour print show Asia/Baku `дд.мм.гггг` via `bakuDateDisplay`. Forecast axis, channel inventory, HK roster, BAR calendar, and occupancy grid headers use `bakuDateShort` (`дд.мм`). The executive cockpit and agency stay dates use `DatePicker`. Inputs and API bodies stay `YYYY-MM-DD`. No Scaffold ✅ / Pilot change.

**Pre-arrival door (2026-10-31):** a stay that is not `IN_HOUSE` changes room immediately when its dates are free. A dirty door and an in-house guest who leaves before arrival do not block. Overlapping dates are refused and no `PENDING` plan is written. An in-house move still stays `PENDING` until the target is Clean or Inspected. The card hides cancelled plans. AC-HOT-AMEND stays 🟡 (UAT §35). No Scaffold ✅ / Pilot change.

**In-house room → clinic (2026-10-30):** The reservation card applies a door change through `requestRoomMove` → `relocateReservationRoom`, which already publishes `SATELLITE_HOTEL_ROOM_CHANGED`. An in-house schedule room change publishes the same event. Clinic `handleRoomChanged` and `handleStayProductChanged` write `roomNumber` on every OPEN episode of that reservation (and in-progress visits). A room assign before check-in still reaches the clinic on check-in. No Scaffold ✅ / Pilot change.

**Loose guest folio (2026-10-30):** `foldLooseGuestFolioOntoPrimary` moves lines from an open GUEST folio with no `reservationGuestId` onto the open primary guest folio, then deletes the empty row. Runs from `listFolios`, `ensurePartyGuestFolios` / party reconcile, `checkoutReservation`, and night-audit due-out. No primary folio yet → the loose folio stays. Does **not** merge named guest, company, or agency folios. No Scaffold ✅ / Pilot change. HOT-FOLIO-DESK stays API.

**Folio ledger / open-debt payment (2026-10-27):** Signed ledger UI; Accept payment prefers open-debt articles (`PAYMENT_ARTICLE_NO_OPEN_DEBT` unless `allowCredit`). Negative: `__tests__/folio-open-debt.spec.ts`. Does **not** reopen AC-HOT-CASH Scaffold ✅ or Pilot. HOT-FOLIO-DESK stays API (UAT open).

**Folio Debit|Credit + revenue catalog v2 (2026-10-29):** Stay-wide lodging Accept payment (`postStayArticlePayment`); Debit|Credit ledger; `allowManualCharge`/`allowManualPayment` flags; med night → PKG only. Negatives: `__tests__/folio-open-debt.spec.ts` + `__tests__/folio-ledger-display.spec.ts`. Does **not** reopen AC-HOT-CASH Scaffold ✅ or Pilot. AC-HOT-REV stays 🟡. HOT-FOLIO-DESK stays API until §27 1c re-signed. The one-shot Nafta remap scripts were removed after apply (2026-10-31).

**Folio desk UI polish (2026-10-29):** Drop Sətir column; rose/sky Debit|Credit column wash; actions header `…`; row **Bu sətri ödə** via `FolioPayLineModal` (**GUEST** open positive charge only); `EraMenu` portal; short Otaq/Tibbi paket labels; PKG Təsvir i18n (`packageNightNote`) without dates + `nafta-folio-label-cleanup.mjs`. ADR `hotel-folio-desk` + module-map `POST …/charges/[chargeId]/pay`. Shipped PR #368/#369; staging cleanup applied (2 labels + 177 PKG descs). No Scaffold / Pilot / edition change.

**Folio/revenue second-pass (2026-10-29):** Migration backfill ROOM/PKG/CITY_TAX no Extra charge; SatAdmin `/settings/master-data` flag CRUD; seed/reference PROCEDURE (+ MEDICAL role heal); `setRevenueCodeRole` syncs lodging flags; desk gates `REVENUE_CODE_MANUAL_CHARGE_DENIED` / `REVENUE_CODE_MANUAL_PAYMENT_DENIED`. Does **not** reopen AC-HOT-CASH ✅ or AC-HOT-REV 🟡; Pilot `[ ]`.

**Payment categories + checkout clear (2026-11-01):** `RevenueCode.paymentCategory` / `FolioPayment.paymentCategory` (LODGING|CLINIC|FB|OTHER); Accept payment by category+pocket; header category spends + pocket-net; fold same-guest pockets; checkout clears future clinic extras via internal stay-procedures POST; settle cash outside interactive txn. Mid-stay **Return category credit** (`POST /api/folios/category-refund` / `refundStayCategoryCredit`) FIFO inside one category. Negatives: `__tests__/payment-category-pay.spec.ts` (cross-category isolation, NO_UNUSED, REFUND_EXCEEDS, FIFO). Does **not** reopen AC-HOT-CASH Scaffold ✅; Pilot `[ ]`. HOT-FOLIO-DESK stays API.

**FO list polish (2026-11-02):** `/fo/reservations` children column + departed strike + Res.ID copy + filter label align; `/fo/in-house` live party via `includeParty=1`. HOT-UI-01 SHIPPED deepen. Does **not** reopen AC-HOT-FO Scaffold ✅; Pilot `[ ]`.

**Kit CatalogField dismiss (2026-11-02):** FO card Source / other SEARCHABLE fields — portaled combobox closes on outside pointer/focus, Escape, and clear (kit `CatalogField`; CLI-37 deepen; disabled closes). Does **not** reopen AC-HOT-FO; Pilot `[ ]`.

**FO card group-box + commercial strip (2026-11-02):** Left column `FieldGroupBox`/`FieldPanel` (legend on border); Travel agent / Company group; payer + Gross/Net `OPS_HOT` chips left, Müqavilə right when AGENCY/COMPANY; GUEST clears contract; Distribution link when empty (no FO contract create). Kit global 1px label density. HOT-BOOK-02 / HOT-CL-01 SHIPPED deepen. Does **not** reopen AC-HOT-FO / AC-HOT-CASH Scaffold ✅; Pilot `[ ]`. Additional stays collapsed `FieldSection`. **Second-pass:** contract options scoped to active payer when both agency+company set; mismatched contract cleared on payer flip. **Chrome:** LookupPlus + stay plane `h-9 w-9` `rounded-lg` aligned to field height.

**Lodging night posts past the desk gate (2026-10-30):** Night audit passes `night_audit` into the package night as well as the room night. Card “post this night” and early-checkout remainder pass `system`. Extra charge on the folio still rejects ROOM/PKG/CITY_TAX. Does **not** lift AC-HOT-REV off 🟡 or HOT-FOLIO-DESK off API. Pilot `[ ]`.

**HK playbook/i18n (2026-10-27):** OpsUI filter+one grid+modal + one PRIMARY across discrepancy/closed/forecast/roster/rotation/minibar/consumption/stock; laundry money coerce (HK+FO); en/az/ru keys (`discrepancyHint`, closed-rooms nav without OOO). Nafta HK deepen stays **🟡** (out of AC-HOT-HK ✅). Does **not** reopen AC-HOT-HK Scaffold or Pilot. UAT §34 still open — not SHIPPED.

**HK table shell tokens (2026-10-28):** Secondary HK lists use kit `DATA_TABLE_SHELL` / `CARD_CONTAINER` (`rounded-2xl`), not hand `rounded` boxes. UI polish only — Nafta deepen stays **🟡**; AC-HOT-HK Scaffold / Pilot unchanged.

**Seed hygiene (2026-09-22):** Boot `db:seed` is reference insert-if-missing only ([ADR satellite-seed-hygiene](../adr/satellite-seed-hygiene.md)); wipe/demo is `db:seed:demo`. Not implied as droplet boot. No Scaffold/ga change.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-HOT-FO | Front office screen chain (arrive/stay/depart) | ✅ | [ ] | `__tests__/fo-gates-negative.spec.ts` + `__tests__/inventory-caps.spec.ts` + `__tests__/stay-slice-align.spec.ts` + HOT-FO/BOOK | Negative: Avl=0 (`TYPE_CAP`), DIRTY assign, names-incomplete, overlapping named guest. Type allowance and house allowance default 0; stop-sell still zeros the night. Assigned door counts as its physical type; a slice past checkout does not keep the door |
| AC-HOT-FO-SHARE | Shared twin assignment (union gender pool) | ✅ | [ ] | `__tests__/shared-twin-negative.spec.ts` + HOT-FO-03 | T2; M/F only; N beds; vacated-bed reuse (`nextFreeShareBedIndex`); OTA exclusive; last-out DIRTY; break/cancel. In-house suggestions use the same today-through-checkout window as a room move. HOT-FO-03 Status=API until UAT §30. Does not add a Scaffold row |
| AC-HOT-CASH | FO money / City Ledger MVP | ✅ | [ ] | `__tests__/p5-fo-money-negative.spec.ts` + `__tests__/transfer-guest-to-payer.spec.ts` + `__tests__/room-payer-routing.spec.ts` + `__tests__/folio-open-debt.spec.ts` + `__tests__/folio-ledger-display.spec.ts` + `__tests__/cash-shift-ensure.spec.ts` + `__tests__/payment-category-pay.spec.ts` + HOT-CASH/CO/CL; UAT §27 1c / §29 1a–1b / §6b | Negative: CL gate, guest balance, DEPOSIT settle refused, TRANSFERRED_AR refund, discount, NO_PAYER_ON_STAY / MOVE_PAYER_FAILED; room-payer policy; open-debt article vs ROOM credit (1005); Debit|Credit helpers; paymentCategory isolation + category refund NO_UNUSED/EXCEEDS/FIFO. Stay-wide lodging pay + row Bu sətri ödə UI polish do not reopen Scaffold |
| AC-HOT-AG-COMM | Agency commission payable (AP ≠ CL) | 🟡 | [ ] | ADR hotel-agency-commission-payable; `__tests__/agency-commission.spec.ts`; HOT-AG-COMM-01…04 | **Out of Scaffold BE rollup.** Unit negatives + event fail-closed; Release + Finance pay sibling. UAT §27c open → no Scaffold ✅. Does not reopen AC-HOT-CASH |
| AC-HOT-HK | Housekeeping + maintenance | ✅ | [ ] | `__tests__/hk-status-negative.spec.ts` + `occupied-hk-lock.spec.ts` | DIRTY not assignable; CLEAN/INSPECTED; FO rack and RoomInfo cannot flip cleanliness on IN_HOUSE. The `/hk/rooms` exception (Dirty/Pickup/Clean on an occupied door) is Nafta deepen, not this ✅ — no negative suite. **Not** full Nafta deepen |
| AC-HOT-RATE | Dynamic rate plans (scoped) | ✅ | [ ] | ADR hotel-dynamic-rate-plans + pricing-engine tests | **Scope-cut:** BAR Excel HOT-02 = separate BLOCKED contour (not this AC) |
| AC-HOT-MDM | Guest MDM link + masked ops profile | ✅ | [ ] | `__tests__/mdm-negative.spec.ts` + guest-identity | Strict deny; masked ops-profile; invalid FIN merge schema |
| AC-HOT-CM | Channel Manager (Channex ARI + inbound + IBE) | 🟡 | [ ] | `__tests__/channel-manager-hardening.spec.ts` + `channel-manager-isolation.spec.ts` + `ota-ingest.spec.ts` | **Out of Scaffold BE rollup.** Negatives: unmapped UUID, CORS no `*`, IBE key header-only, hold deduct, dual ARI endpoints. HOT-CH-02 STUB until cert UAT. |
| AC-HOT-INT | Integrations (KKM, locks, B2C widget) | 🟡 | [ ] | HOT-03/04 STUB; HOT-06 HEADLESS (extension); Wave 6 lab SHOW for SuperAdmin policy + clinic Issue-ticket; Wave 8 ALS ingest stamps; Wave 9 field runbook | Explicit stub — **excluded from Scaffold BE rollup** (external ⏸). Lab: [`reports/hot06-lab-signoff.md`](../../reports/hot06-lab-signoff.md). Field: [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md). Still not SHIPPED (field SPA Insert open). |
| AC-HOT-TENANT | SHARED pool: `organizationId` on ops rows | 🟡 | [ ] | CP-TENANT-01; kit fail-closed tenant extension; Wave 1 hotel session/JWT `enterSatelliteTenant`; Wave 4 cron `runCronForEachTenant` + `byOrganization`; Wave 5 lab `saas-wave5-two-org-isolation`; Wave 9 live pool smoke; Wave 10 cron User DISTINCT discover | **Excluded from Scaffold BE rollup.** Lab + live-smoke + cron discover available; still not Scaffold ✅ (field two-org UAT open). Signoff: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md) |
| AC-HOT-AGP | Agency portal (CP grant + PMS book + FO inbox) | 🟡 | [ ] | ADR hotel-agency-portal; HOT-AGP-01/02/03; `__tests__/agency-portal-negative.spec.ts` | Negatives landed (SSO HMAC + auto-confirm default OFF); Scaffold ✅ after fuller isolation suite + UAT §31 |
| AC-HOT-TOUR | Guest group tours (boarding + TOUR folio + policy) | ✅ | [ ] | ADR hotel-guest-tours; `__tests__/tours-money.spec.ts` (boarding / CHARGE_ON_ADD / close / refund) + `tours-negative.spec.ts`; UAT-SMOKE §14b; `TourOpsPolicy`; UI grids+modals + bare print | **Out of Scaffold BE rollup** — Nafta add-on. Edition `mvp`. UX closeout 2026-10-27. |
| AC-HOT-XFER | Stay-linked transfers (TRANSFER folio on complete) | ✅ | [ ] | `__tests__/transfer-fleet.spec.ts` (no live stay; vehicle/tour overlap) + `transfer.service`; UAT-SMOKE §14; airport = `?hasFlight=1` | **Out of Scaffold BE rollup** — same SKU `hotel_transfers`. Closeout 2026-10-27. |
| AC-HOT-PKG-NAFTA | Medical SKU resolve + notes import (Wave A) | 🟡 | [ ] | `__tests__/medical-package-resolve.spec.ts` + `reservation-notes-import-adapter.spec.ts`; ADR nafta-medical-sku-dual-run | **Out of Scaffold BE rollup** — dual-run Nafta; not FO money scaffold. Infotur posts from the card tariff, not the medical grid. Stays 🟡 |
| AC-HOT-PKG-COMPOSE | Composed nightly sell mix (Wave D) | 🟡 | [ ] | `__tests__/nafta-package-compose.spec.ts`; HOT-PKG-03 | **Out of Scaffold BE rollup** — save, night audit, and the open card share the compose; a fixed night stays. No field UAT. Stays 🟡 |
| AC-HOT-PKG-PAX | Per-pax check-in events for multi-program stay (Wave E) | 🟡 | [ ] | HOT-PKG-04; `paxKey` on lifecycle payload; `__tests__/pax-lifecycle-person.spec.ts` companion does not inherit primary MDM id | **Out of Scaffold BE rollup** — unit negative only; field UAT open, Scaffold stays 🟡 |
| AC-HOT-CO-EARLY | Early unused-nights refund (net VAT, all folios) | 🟡 | [ ] | `__tests__/early-checkout-unused-nights.spec.ts` + HOT-CO-04 | **Out of Scaffold BE rollup** until fuller void/lump/CL negatives; does not reopen AC-HOT-CASH |
| AC-HOT-AMEND | Mid-stay product change + Manual Price bar | 🟡 | [ ] | `__tests__/stay-amendment-policy.spec.ts` + `__tests__/door-clash-window.spec.ts` + `__tests__/stay-door-move.spec.ts` + `__tests__/stay-slice-align.spec.ts` + HOT-FO-04 | **Not Scaffold ✅** — field-intent Nafta FO; UAT §35 open. Before check-in the room changes immediately when the dates are free; no move plan. An in-house move still waits. Card save, an Elektra upsert, and an OTA modify move the previous tariff onto open slices; a posted night and the charged type stay. A zero slice plan does not replace the card tariff. Stays 🟡 |
| AC-HOT-DEPART-GUEST | Party Depart guest (stay remains IN_HOUSE) | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (share 409, last-pax `needs_checkout`, stay patch keeps `departedAt`) + `__tests__/ensure-guest-folios.spec.ts` (closed folio is not recreated) + clinic `__tests__/guest-departed-moved.spec.ts` + HOT-FO-05 | **Out of Scaffold BE rollup** — ADR hotel-reservation-card-and-party-ops; UAT §43 open; orch fans out `GUEST_DEPARTED`. Stays 🟡 |
| AC-HOT-PAX-MOVE | Move guest / Swap rooms within booking | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (move group/empty/departed) + `__tests__/swap-rooms-negative.spec.ts` + HOT-FO-06/07 | **Out of Scaffold BE rollup** — UAT §44 open; dialog copy az/ru/en; orch fans out `GUEST_MOVED`. Stays 🟡 |
| AC-HOT-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `hotel-rbac` + staff-provision unknown role; ADR hotel-domain-permissions-and-rbac; `/settings/access` | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-HOT-CARD-PANE | Reservation card right-pane density (Guests / Rate Grid / Folio / Notes) | 🟡 | [ ] | HOT-BOOK-06…09; UAT §45–§48; Sprint S-22…S-24; `e2e/reservation-card.spec.ts` | **Out of Scaffold BE rollup** — UI density only; not SHIPPED until UAT; no Opera windows |
| AC-HOT-REV | Category revenue code + day document v2 (money vs quantity) | 🟡 | [ ] | ADR hotel-revenue-code-resolution; HOT-REV-01; kit `hotel-revenue-route.test.ts` | **Out of Scaffold BE rollup.** Nafta template v2 is the live catalog. One-shot remap scripts were removed after apply (2026-10-31). The 2026-10-27 SQL seeds are archive-only. No night-audit negative suite. Blank category refuses the charge; hub Zod/create refuse non-zero pending without `revenueCode`. Does not darken BE ✅ and does not reopen AC-HOT-CASH. |
| AC-HOT-AUD | Mutation audit Layer A (HTTP belt) + Layer B enrich catalog | 🟡 | [ ] | ADR era-mutation-audit-standard; HOT-AUD-01; `__tests__/mutation-audit-belt.spec.ts`; `hotel-page-route-inventory` `/admin/audit` reports-not-admin; kit belt; CI fail-closed; Wave B CashShift + DAY_CLOSE; Wave E compound `(organizationId, createdAt)` | **Out of Scaffold BE rollup.** Layer A + stay/folio Layer B + CashShift/DAY_CLOSE + Wave E index landed; UAT + soft-fail negatives open — max 🟡; hash-chain deferred. Does not darken BE ✅. |

**Edition / wave rollup (BE, in-scope)** = worst(FO, CASH, HK, RATE, MDM) → **✅**.  
AC-HOT-INT remains 🟡 and is **out of Scaffold BE rollup** until vendor modes leave STUB.  
AC-HOT-TENANT is 🟡 (Nafta placement is SHARED; `organizationId` covers roots and child/line rows) and stays **out of Scaffold BE rollup** until field two-org UAT (does not undo FO money scaffold).  
AC-HOT-AGP is 🟡 (P0–P1 landing) and stays **out of Scaffold BE rollup** until negative suite is green.  
AC-HOT-AG-COMM is 🟡 and stays **out of Scaffold BE rollup** until fuller UAT §27c.  
AC-HOT-CO-EARLY is 🟡 and stays **out of Scaffold BE rollup**.  
AC-HOT-TOUR is Scaffold ✅ (negatives + UAT UI path) and stays **out of Scaffold BE rollup**.  
AC-HOT-XFER is Scaffold ✅ (UAT §14) and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-NAFTA is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-COMPOSE is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-PAX is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.
AC-HOT-REV is 🟡 (category code + day document v2; night audit not run) and stays **out of Scaffold BE rollup**. It does not darken BE ✅.
AC-HOT-AUD is 🟡 (belt + Wave B CashShift/DAY_CLOSE + Wave E compound index; UAT + fuller negatives open; hash-chain deferred) and stays **out of Scaffold BE rollup**. It does not darken BE ✅.

Do not call this table «product readiness» (UI / Pilot still separate).

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-HOT-RATE / HOT-02 | Nafta BAR Excel import | BLOCKED external | Scoped out of AC-HOT-RATE |
| AC-HOT-INT | Live KKM / locks / notify | External ⏸ | Keep STUB; max Scaffold 🟡 |
| HOT-RPT-01/02 | EW Management Reports catalog + nightly ZIP | W1–W3 code delivered (out of BE rollup) | Screens + PDF + ZIP + cubes + 3-year + email ZIP link; VAT columns Total / Net / VAT; trial balance groups revenue codes under a bold department row (code names from `nameAz`/`nameRu`/`nameEn`); negative path `__tests__/hotel-reports-negative.spec.ts` (unknown slug / lang / empty pack); layout families + letterhead + date bar + zero-capacity ratios in `report-layout-families` / `report-letterhead` / `report-date-bar` / `report-workspace-export` specs — Scaffold 🟡 not ✅; no AC-HOT-RPT ✅ |
| Nafta HK deepen | Roster/sheet/laundry/forecast/discrepancy/policy + `/hk/rooms` + secondary HK empty chrome / sidebar groups / maids picker / laundry preview / void IN_PLANT on grids+checkout / stay linen override + playbook filter/grid/modal + kit table shell tokens | Out of AC-HOT-HK rollup | SCREEN + `__tests__/hk-nafta.spec.ts` + `__tests__/hk-soft-sort.spec.ts` (soft sort + laundry amount + express %). Soft sort departures→VIP→needed-by→DIRTY→duty→room#. Void IN_PLANT; maids dept/unlink; discrepancy create modal; forecast 1/7/14/30; one PRIMARY; `DATA_TABLE_SHELL` / `CARD_CONTAINER` on secondary HK. Stays 🟡, not Scaffold ✅. UAT §34 open — do not call AC-HOT-HK «весь Nafta» |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| HOT-CO-04 | Early checkout unused-nights refund (net VAT, default CASH) | Out of BE rollup | ADR Accepted; AC-HOT-CO-EARLY 🟡 until fuller negatives; SHIPPED OpsUI |
| AC-HOT-REV | Night audit of day document v2 | Out of BE rollup | HOT-REV-01 API; hub blank-`revenueCode` refuse + NA early fail; no NA negative suite; not SHIPPED |
| AC-HOT-AUD | UAT + soft-fail / exempt negatives | Out of BE rollup | Wave B CashShift + DAY_CLOSE + Wave E compound index landed 2026-10-29; hash-chain deferred; folio/stay journal already Layer B; Nest API cutover is P0 platform debt (out of this AC) |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-hotel-pms/__tests__/p5-fo-money-negative.spec.ts` | AC-HOT-CASH |
| `era-hotel-pms/__tests__/folio-open-debt.spec.ts` | AC-HOT-CASH (open-debt article gate) |
| `era-hotel-pms/__tests__/folio-ledger-display.spec.ts` | AC-HOT-CASH (Debit\|Credit helpers) |
| `era-hotel-pms/__tests__/transfer-guest-to-payer.spec.ts` | AC-HOT-CASH (MOVE_PAYER_CL) |
| `era-hotel-pms/__tests__/cash-shift-ensure.spec.ts` | AC-HOT-CASH (ensureOpenCashShift / folio+pending gate) |
| `era-hotel-pms/__tests__/payment-category-pay.spec.ts` | AC-HOT-CASH (paymentCategory isolation + category-refund NO_UNUSED/EXCEEDS/FIFO/reason) |
| `era-hotel-pms/__tests__/fo-gates-negative.spec.ts` | AC-HOT-FO |
| `era-hotel-pms/__tests__/shared-twin-negative.spec.ts` | AC-HOT-FO-SHARE |
| `era-hotel-pms/__tests__/mdm-negative.spec.ts` | AC-HOT-MDM |
| `era-hotel-pms/__tests__/hotel-rbac.spec.ts` | AC-HOT-RBAC |
| `era-hotel-pms/__tests__/staff-provision.spec.ts` | AC-HOT-RBAC (unknown role) |
| `era-hotel-pms/__tests__/hk-status-negative.spec.ts` | AC-HOT-HK |
| `era-hotel-pms/__tests__/hk-nafta.spec.ts` | Nafta HK deepen (out of AC rollup) |
| `era-hotel-pms/__tests__/hk-soft-sort.spec.ts` | Nafta HK deepen (soft sort + laundry amount/express; not full AC-HOT-HK Scaffold) |
| `era-hotel-pms/__tests__/tours-money.spec.ts` | AC-HOT-TOUR |
| `era-hotel-pms/__tests__/tours-negative.spec.ts` | AC-HOT-TOUR |
| `era-hotel-pms/__tests__/transfer-fleet.spec.ts` | AC-HOT-XFER |
| `era-hotel-pms/__tests__/hotel-reports-negative.spec.ts` | HOT-RPT-01/02 |
| `era-hotel-pms/__tests__/report-layout-families.spec.ts`, `report-letterhead.spec.ts`, `report-date-bar.spec.ts`, `report-workspace-export.spec.ts` | HOT-RPT-01/02 |
| `era-hotel-pms/__tests__/channel-manager-hardening.spec.ts` | AC-HOT-CM |
| `era-hotel-pms/__tests__/channel-manager-isolation.spec.ts` | AC-HOT-CM |
| `era-hotel-pms/__tests__/sales-contract-status.spec.ts` | HOT-AG-01 status transitions (not a new AC; does not reopen AC-HOT-CASH) |
