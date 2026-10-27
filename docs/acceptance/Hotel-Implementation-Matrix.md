# Hotel — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Hotel-Product-Readiness-Matrix.md`](./Hotel-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-04):** Negative-path suites landed — `__tests__/p5-fo-money-negative.spec.ts`, `fo-gates-negative.spec.ts`, `mdm-negative.spec.ts`, `hk-status-negative.spec.ts`. A settlement line with method DEPOSIT is refused (`DEPOSIT_INTAKE_CLOSED`). Old HELD rows move once onto a blue room payment. That does not add a Scaffold ✅ and does not change AC-HOT-CASH, which stays ✅ on the existing negative path. Pilot-ready stays open.

**CL closeout (2026-10-27):** `transfer-guest-to-payer.spec.ts` covers `NO_PAYER_ON_STAY` / company-prefer / agency fallback. Second-pass: shell Front Cash CL nav, unsettled Folio card, undo keeps settlement when AR remains. AC-HOT-CASH Scaffold ✅ unchanged (negatives present). Pilot-ready still `[ ]`.

**Finance→Hotel payment apply (2026-10-27):** HOT-CL-07 API — allocate + bank match → hotel `payment-applied` via outbox/reconcile; peer URL from SatelliteEndpoint (ADR satellite-peer-url-resolution). Does not reopen AC-HOT-CASH Scaffold; Pilot unchanged.

**Room payer / commission basis (2026-10-27):** `Reservation.roomPayer` + `commissionBasis`, contract `commissionBasis`, card strip, mid-stay `COMMERCIAL_AMEND_REQUIRED`. ADR hotel-room-payer-and-commission-basis. Does not reopen AC-HOT-CASH Scaffold or Pilot.

**FO contract leftovers (2026-10-27):** `defaultsFromSalesContract` (corp→COMPANY); mandatory-contract hint + B2B link; `GET /api/fo/sellable?salesContractId=` allotment preview; API code→toast for payer/contract required. Second-pass: allotment-exhausted → 409 + create/group toasts. Negatives already on AC-HOT-CASH (`CONTRACT_REQUIRED_FOR_PAYER` path + room-payer policy). Scaffold ✅ / Pilot unchanged.

**B2B contracts UI honesty (2026-10-27):** `/distribution/contracts` icon row actions (Cancel/Expire); no silent `AGENCY` default; create requires `counterpartyType` + `companyId` for CORPORATE; list `companyId`; hide decorative minStay/CTA/CTD/deposit (ADR Open debts SC-REST/DEP/REL). Status transition negatives: `__tests__/sales-contract-status.spec.ts`. Second-pass: EXPIRED/CANCELLED → notes/`externalRef` only; allotment upsert/delete 400; create-block hidden. **No new AC row** — HOT-AG-01 COVERAGE SHIPPED; does **not** reopen AC-HOT-CASH Scaffold ✅ or Pilot.

**Folio ledger / open-debt payment (2026-10-27):** Signed ledger UI; Accept payment prefers open-debt articles (`PAYMENT_ARTICLE_NO_OPEN_DEBT` unless `allowCredit`). Negative: `__tests__/folio-open-debt.spec.ts`. Does **not** reopen AC-HOT-CASH Scaffold ✅ or Pilot. HOT-FOLIO-DESK stays API (UAT open).

**HK playbook/i18n (2026-10-27):** OpsUI filter+one grid+modal + one PRIMARY across discrepancy/closed/forecast/roster/rotation/minibar/consumption/stock; laundry money coerce (HK+FO); en/az/ru keys (`discrepancyHint`, closed-rooms nav without OOO). Nafta HK deepen stays **🟡** (out of AC-HOT-HK ✅). Does **not** reopen AC-HOT-HK Scaffold or Pilot. UAT §34 still open — not SHIPPED.

**Seed hygiene (2026-09-22):** Boot `db:seed` is reference insert-if-missing only ([ADR satellite-seed-hygiene](../adr/satellite-seed-hygiene.md)); wipe/demo is `db:seed:demo`. Not implied as droplet boot. No Scaffold/ga change.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-HOT-FO | Front office screen chain (arrive/stay/depart) | ✅ | [ ] | `__tests__/fo-gates-negative.spec.ts` + `__tests__/stay-slice-align.spec.ts` + HOT-FO/BOOK | Negative: Avl=0, DIRTY assign, names-incomplete, overlapping named guest. Assigned door counts as its physical type; a slice past checkout does not keep the door |
| AC-HOT-FO-SHARE | Shared twin assignment (union gender pool) | ✅ | [ ] | `__tests__/shared-twin-negative.spec.ts` + HOT-FO-03 | T2; M/F only; N beds; vacated-bed reuse (`nextFreeShareBedIndex`); OTA exclusive; last-out DIRTY; break/cancel. In-house suggestions use the same today-through-checkout window as a room move. HOT-FO-03 Status=API until UAT §30. Does not add a Scaffold row |
| AC-HOT-CASH | FO money / City Ledger MVP | ✅ | [ ] | `__tests__/p5-fo-money-negative.spec.ts` + `__tests__/transfer-guest-to-payer.spec.ts` + `__tests__/room-payer-routing.spec.ts` + `__tests__/folio-open-debt.spec.ts` + HOT-CASH/CO/CL; UAT §27 1c / §29 1a–1b | Negative: CL gate, guest balance, DEPOSIT settle refused, TRANSFERRED_AR refund, discount, NO_PAYER_ON_STAY / MOVE_PAYER_FAILED; room-payer policy; open-debt article vs ROOM credit (1005). Ledger/payment deepen does not reopen Scaffold |
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
| AC-HOT-PKG-COMPOSE | Composed nightly sell mix (Wave D) | 🟡 | [ ] | `__tests__/nafta-package-compose.spec.ts`; HOT-PKG-03 | **Out of Scaffold BE rollup** |
| AC-HOT-PKG-PAX | Per-pax check-in events for multi-program stay (Wave E) | 🟡 | [ ] | HOT-PKG-04; `paxKey` on lifecycle payload; `__tests__/pax-lifecycle-person.spec.ts` companion does not inherit primary MDM id | **Out of Scaffold BE rollup** — unit negative only; field UAT open, Scaffold stays 🟡 |
| AC-HOT-CO-EARLY | Early unused-nights refund (net VAT, all folios) | 🟡 | [ ] | `__tests__/early-checkout-unused-nights.spec.ts` + HOT-CO-04 | **Out of Scaffold BE rollup** until fuller void/lump/CL negatives; does not reopen AC-HOT-CASH |
| AC-HOT-AMEND | Mid-stay product change + Manual Price bar | 🟡 | [ ] | `__tests__/stay-amendment-policy.spec.ts` + `__tests__/door-clash-window.spec.ts` + `__tests__/stay-door-move.spec.ts` + `__tests__/stay-slice-align.spec.ts` + HOT-FO-04 | **Not Scaffold ✅** — field-intent Nafta FO; UAT §35 open. Card save, an Elektra upsert, and an OTA modify move the previous tariff onto open slices; a posted night and the charged type stay. A zero slice plan does not replace the card tariff. Stays 🟡 |
| AC-HOT-DEPART-GUEST | Party Depart guest (stay remains IN_HOUSE) | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (share 409, last-pax `needs_checkout`, stay patch keeps `departedAt`) + `__tests__/ensure-guest-folios.spec.ts` (closed folio is not recreated) + clinic `__tests__/guest-departed-moved.spec.ts` + HOT-FO-05 | **Out of Scaffold BE rollup** — ADR hotel-reservation-card-and-party-ops; UAT §43 open; orch fans out `GUEST_DEPARTED`. Stays 🟡 |
| AC-HOT-PAX-MOVE | Move guest / Swap rooms within booking | 🟡 | [ ] | `__tests__/depart-guest-negative.spec.ts` (move group/empty/departed) + `__tests__/swap-rooms-negative.spec.ts` + HOT-FO-06/07 | **Out of Scaffold BE rollup** — UAT §44 open; dialog copy az/ru/en; orch fans out `GUEST_MOVED`. Stays 🟡 |
| AC-HOT-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `hotel-rbac` + staff-provision unknown role; ADR hotel-domain-permissions-and-rbac; `/settings/access` | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-HOT-CARD-PANE | Reservation card right-pane density (Guests / Rate Grid / Folio / Notes) | 🟡 | [ ] | HOT-BOOK-06…09; UAT §45–§48; Sprint S-22…S-24; `e2e/reservation-card.spec.ts` | **Out of Scaffold BE rollup** — UI density only; not SHIPPED until UAT; no Opera windows |
| AC-HOT-REV | Category revenue code + day document v2 (money vs quantity) | 🟡 | [ ] | ADR hotel-revenue-code-resolution; HOT-REV-01; kit `hotel-revenue-route.test.ts` | **Out of Scaffold BE rollup.** No night-audit negative suite. Blank category refuses the charge; group GL `601.04` is refused at post. Night audit with the new document not run — not SHIPPED. Does not darken BE ✅ and does not reopen AC-HOT-CASH. |
| AC-HOT-AUD | Mutation audit Layer A (HTTP belt) + Layer B enrich catalog | 🟡 | [ ] | ADR era-mutation-audit-standard; HOT-AUD-01; `__tests__/mutation-audit-belt.spec.ts`; `hotel-page-route-inventory` `/admin/audit` reports-not-admin; kit belt | **Out of Scaffold BE rollup.** Belt + UI/API parity (`/admin/audit` + `GET /api/admin/audit`) landed; UAT + fuller negatives (exempt skip / audit-fail soft) open — max 🟡. Does not darken BE ✅. |

**Edition / wave rollup (BE, in-scope)** = worst(FO, CASH, HK, RATE, MDM) → **✅**.  
AC-HOT-INT remains 🟡 and is **out of Scaffold BE rollup** until vendor modes leave STUB.  
AC-HOT-TENANT is 🟡 (Nafta placement is SHARED; `organizationId` covers roots and child/line rows) and stays **out of Scaffold BE rollup** until field two-org UAT (does not undo FO money scaffold).  
AC-HOT-AGP is 🟡 (P0–P1 landing) and stays **out of Scaffold BE rollup** until negative suite is green.  
AC-HOT-CO-EARLY is 🟡 and stays **out of Scaffold BE rollup**.  
AC-HOT-TOUR is Scaffold ✅ (negatives + UAT UI path) and stays **out of Scaffold BE rollup**.  
AC-HOT-XFER is Scaffold ✅ (UAT §14) and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-NAFTA is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-COMPOSE is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-PKG-PAX is 🟡 and stays **out of Scaffold BE rollup**.
AC-HOT-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.
AC-HOT-REV is 🟡 (category code + day document v2; night audit not run) and stays **out of Scaffold BE rollup**. It does not darken BE ✅.
AC-HOT-AUD is 🟡 (belt via `jsonOk` landed; UAT + fuller negatives open) and stays **out of Scaffold BE rollup**. It does not darken BE ✅.

Do not call this table «product readiness» (UI / Pilot still separate).

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-HOT-RATE / HOT-02 | Nafta BAR Excel import | BLOCKED external | Scoped out of AC-HOT-RATE |
| AC-HOT-INT | Live KKM / locks / notify | External ⏸ | Keep STUB; max Scaffold 🟡 |
| HOT-RPT-01/02 | EW Management Reports catalog + nightly ZIP | W1–W3 code delivered (out of BE rollup) | Screens + PDF + ZIP + cubes + 3-year + email ZIP link; negative path `__tests__/hotel-reports-negative.spec.ts` (unknown slug / lang / empty pack); layout families + letterhead + date bar + zero-capacity ratios in `report-layout-families` / `report-letterhead` / `report-date-bar` / `report-workspace-export` specs — Scaffold 🟡 not ✅; no AC-HOT-RPT ✅ |
| Nafta HK deepen | Roster/sheet/laundry/forecast/discrepancy/policy + `/hk/rooms` + secondary HK empty chrome / sidebar groups / maids picker / laundry preview / void IN_PLANT on grids+checkout / stay linen override + playbook filter/grid/modal polish | Out of AC-HOT-HK rollup | SCREEN + `__tests__/hk-nafta.spec.ts` + `__tests__/hk-soft-sort.spec.ts` (soft sort + laundry amount + express %). Soft sort departures→VIP→needed-by→DIRTY→duty→room#. Void IN_PLANT on `/hk/laundry`, `/fo/laundry`, and checkout; auto-retry. Maids dept/unlink; discrepancy create modal; forecast 1/7/14/30; one PRIMARY per screen. Stays 🟡, not Scaffold ✅. UAT §34 open — do not call AC-HOT-HK «весь Nafta» |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| HOT-CO-04 | Early checkout unused-nights refund (net VAT, default CASH) | Out of BE rollup | ADR Accepted; AC-HOT-CO-EARLY 🟡 until fuller negatives; SHIPPED OpsUI |
| AC-HOT-REV | Night audit of day document v2 | Out of BE rollup | HOT-REV-01 API; no negative suite; not SHIPPED |
| AC-HOT-AUD | UAT + soft-fail / exempt negatives; `jsonOk`-bypass routes | Out of BE rollup | Belt + path/API parity landed; HOT-AUD-01 API until UAT |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-hotel-pms/__tests__/p5-fo-money-negative.spec.ts` | AC-HOT-CASH |
| `era-hotel-pms/__tests__/folio-open-debt.spec.ts` | AC-HOT-CASH (open-debt article gate) |
| `era-hotel-pms/__tests__/transfer-guest-to-payer.spec.ts` | AC-HOT-CASH (MOVE_PAYER_CL) |
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
