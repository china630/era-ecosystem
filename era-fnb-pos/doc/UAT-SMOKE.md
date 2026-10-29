# UAT smoke â€” era-fnb-pos





## SSO paths (platform entry — v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home â†’ industry tile â†’ **Open** â†’ satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register â†’ Orchestrator only (no satellite `/register`).



## FB-0 â€” Scaffold

- [x] `GET /api/health` â†’ 200
- [x] Home / floor pages load
- [x] Prisma Ticket model + `POST /api/tickets`
- [x] Room charge bridge: `POST /api/tickets/{id}/room-charge`

## FB-0 — Auth & menu

1. **UI:** `/login` — enter **ERA ID** (`orgNo`, six digits) on SHARED pool; optional `?org=` prefill. Owner login posts `{ "login", "password", "orgNo" }` (not UUID `organizationId`).
2. **API (DEDICATED / appliance):** `POST /api/auth/login` `{ "login": "waiter", "password": "waiter" }` — session cookie. **SHARED:** add `"orgNo": "104221"`.
3. **PIN floor:** `/pin?org=104221` — posts `{ "pin", "orgNo", "outletId" }`.
4. `GET /api/menu` — seeded items
5. `GET /api/menu?dailyOnly=true` — board uses **Asia/Baku** civil `@db.Date` (`bakuCivilUtcDate(todayBakuYmd())`), not host midnight / UTC slice
6. Manager: `/admin/menu` — categories on the left, one dish table (name + price) on the right; search; inactive hidden unless “show inactive”; PLU / recipe SKU / image inside the dish modal
7. Manager: `/admin/tables` — create/edit/delete static tables
8. Manager: `/admin/daily-menu` (or DailyMenuAdminPanel) — default board date = Asia/Baku today
9. RBAC Variant A: doors are grants (`api:*` / `screen:*`), not role names. Waiter can fire/pay (hotel); manager required for void/Z — strip void on `/admin/access` → API 403. Kitchen without `screen:admin.menu` cannot open that page. Kitchen also cannot `GET /api/tickets` / `GET /api/menu` (till-read grants).

## FNB-RBAC-01 — access matrix (SCREEN; not SHIPPED)

1. Manager login → `/admin/access` — edit `FB_MANAGER`, uncheck `api:tickets.void`, Save, refresh-permissions.
2. Attempt void line → 403.
3. Kitchen PIN (bound outlet) → `/admin/menu` redirects forbidden; `/kds` OK if grant + SKU; `GET /api/tickets` → 403.
4. PIN without `StaffRoster.outletId` → 403 `PIN_OUTLET_UNBOUND`.
5. Kafe edition: waiter package has no `api:tickets.pay` → pay 403 `FNB_WAITER_NO_PAY`.
6. `POST /api/outlets/select` requires `admin:outlet_bind`; PIN session always 403 (cannot rebind).
7. Roster create requires `outletId` + `admin:staff_pin` | `api:labor.roster.write`.
8. Cutover import: PIN session forbidden even with grant.

## FB-3 — Standalone GL (no hotel)

1. Org STANDALONE / settlement not hub — walk-in ticket → **Pay cash**
2. Expect Finance ingest `SATELLITE_FB_SALE_COMPLETED` (journal ref `fb-sale:{receiptId}`)
3. Manager Z-close → `SATELLITE_FB_SHIFT_CLOSED`
4. In-house room-charge path must **not** emit `SATELLITE_FB_SALE_COMPLETED`

## FB-1 — MVP Nafta

1. UI: `/orders` → **POS shift** panel → Open shift — or `POST /api/shifts/open`
2. `GET /api/tables` â€” pick a table id
3. `POST /api/tickets` `{ "tableId": "...", "lines": [{ "description": "Soup", "qty": 2, "unitPriceAzn": 8 }] }`
4. `POST /api/tickets/{id}/fire` â€” lines â†’ FIRED
5. `GET /api/kds/lines` â€” queue visible; `PATCH /api/kds/lines/{lineId}` `{ "kitchenStatus": "DONE" }`
6. UI: `/orders` → **Pay cash** or **Pay card** (or API `{ "method": "CASH"|"CARD" }`)
7. Room charge (with hotel-pms running, or `FB_POS_PMS_STUB=1`):
   - UI: `/orders` → **In-house guest** search → link → **Room charge**
   - API: `GET /api/in-house?query=201` · `PATCH /api/tickets/{id}` · `POST /api/tickets/{id}/room-charge`
8. Void: open new ticket + line â†’ `POST /api/tickets/{id}/lines/{lineId}/void` `{ "reason": "wrong item" }`
9. UI: manager **Z-close** on shift panel — or `POST /api/shifts/close`

## FB-1b — Mixed settlement (Nafta)

See [ADR fb-mixed-settlement-routing](../../docs/adr/fb-mixed-settlement-routing.md) and [ADR unified-settlement-hub](../../docs/adr/unified-settlement-hub.md).

1. Walk-in ticket: `POST /api/tickets` `{ "serviceChannel": "WALK_IN", "walkInLabel": "Street", "lines": [...] }`
2. **Hub mode** (`settlementPolicy.deferWalkInToHub`): `POST /api/tickets/{id}/defer-to-hub` → **200**; pay at hotel `/front-cash/pending`; callback closes ticket
3. **Own mode**: `POST /api/tickets/{id}/pay` `{ "method": "CASH" }` → **201**, local fiscal (`@era/fiscal` mock; empty device catalog → recorded_no_device)
4. In-house: `PATCH /api/tickets/{id}` `{ "roomChargeReservationId": "<uuid-or-room>" }`
5. `POST /api/tickets/{id}/pay` → **400** (settle via room charge)
6. `POST /api/tickets/{id}/room-charge` → folio charge on hotel PMS
7. **UI (F3):** Open shift modal — optional KKM / bank POS select from `GET /api/fiscal/devices`; bound ids stored on `PosShift`

## Quartet (Track A)

1. `node scripts/quartet-smoke.mjs` â€” FB health 200 when dev server up
2. `node era-hotel-pms/scripts/test-pos-bridge.mjs` â€” bridge regression
3. KKM: with a synced mock device, pay returns `fiscal.driver` = `mock`; empty catalog returns skipped `recorded_no_device` (not an env mock receipt)
4. Entitlement: pay without `platform_loyalty` in snapshot â†’ no promotion created in Orch (hooks gated)

## FB-4 — Banquet service day (UI)

1. `/floor` — outlet selector (`GET /api/outlets` + `POST /api/outlets/select`)
2. Banquet: pick active BEO from dropdown → **Open banquet ticket** → `POST /api/tickets` with `beoId`, `outletCode: BANQUET`
3. Walk-in: optional label → **Open walk-in ticket** → `serviceChannel: WALK_IN`
4. `/orders` — ticket list shows WALK_IN / BEO labels
5. Nav: **Daily menu** → `/admin/daily-menu`
6. Daily menu board: pick `Date`, bulk-select menu items (checkboxes), then `Save board` (PUT)
7. Optional: `Copy from yesterday` (POST) and re-open `/admin/daily-menu` to verify selection persists

## FB-5 — Buffet planner (UI) — open

Prerequisite: org has module `fnb_buffet_planner` in orch `activeModules` (and `industry_fnb_pos`). Toggle from workspace auto-Syncs runtime-config; CP snapshot also opens the gate before local profile heals. Manual Super-admin Sync is fallback only.

1. Nav: **Buffet planner** / **Bufet planı** → `/admin/buffet` (hidden without module)
2. Filters: café/outlet, date range (default today…+6 Baku), status (all / draft / …)
3. Master **Plans** table only (no split preview): guests adult/child, dish count·Σ portions, stations, BOM warning dot
4. **New plan** modal → row appears; pencil opens header modal (date/meal/covers/notes)
5. Composition icon (or double-click row) → composition modal: Add dish / edit lines / Lock→Served→Close / Materials / Publish
6. **Copy** icon → duplicate DRAFT for today → header modal opens; occupied slot → 409 toast
7. Empty composition: **Copy dishes from last same meal**
8. Publish → `/admin/daily-menu` merge check for that date/outlet

## FB-OUTLET-01 — Second café + outlet caps / Elektra — open

1. `/admin/settings` → **Cafés / outlets** table
2. Manager with `api:outlets.manage`: **New outlet** → code + name + **shape** (seeds caps) + optional copy menu/halls/tables (duplicate code → 409; code `RESTAURANT` → 400)
3. Edit outlet → rename code/name, caps (till/tables/buffet), contacts; DELETE blocked while OPEN shift
4. Password login → `/select-outlet` tiles → cookie `era_fb_outlet_id`; buffet-only → home `/admin/buffet` (not floor). PIN: credentials → till outlets → names → PIN
5. Floor dropdown lists till outlets only; Buffet admin prefers `capBuffetPlanner`; `/admin/tables` shows copied halls/tables when copy was used
6. Pay a ticket → response `printChrome` shows org/outlet header lines on the till after pay

Evidence: not signed — FNB-09 / multi-outlet / caps / Elektra stay API/SCREEN, not SHIPPED.

## FNB-BUFFET-COST-01 — Buffet cost settings (Wave 1) — open

Prerequisite: migrate `20261028190000_fnb_buffet_cost_settings` (column on `fnb_org_profiles`).

1. Manager with `screen:admin.settings` → `/admin/settings` → row **Buffet cost attribution**
2. Edit → defaults show HYBRID / OVERLAP_PCT 30% / COGS = Day document when `hotelMode` (Nafta); Save
3. Optional: pick outlet → Custom override → set model `OFF` → Save → GET `/api/settings/buffet-cost` shows `outletOverrides`
4. `/api/auth/me` includes `buffetCost` effective for session outlet

Evidence: not signed — settings API/SCREEN only; cost run not built; not SHIPPED / not sellable.

## FNB-BUFFET-COST-01 — Week template + management meals (Wave 2) — open

Prerequisite: migrate `20261028200000_fnb_buffet_week_mgmt`; module `fnb_buffet_planner` on.

1. `/admin/buffet` → tab **Week template** → New template → Add/edit slot (weekday × meal + covers) → optional Capture from plan
2. Set week start (Monday) → **Spawn week plans** → Plans tab shows DRAFT rows (existing slots skipped)
3. Tab **Management meals** → Sign management meal (name × date × meal) → row appears; duplicate name same slot → 409
4. Open a plan composition → forecast line shows plan covers + management count (`GET /api/admin/buffet/covers-rollup`)

Evidence: not signed — SCREEN only; not SHIPPED / not sellable.

## FNB-BUFFET-COST-01 — Staff meals + overlap (Wave 3) — open

Prerequisite: migrate `20261028210000_fnb_buffet_staff_meals`; module `fnb_buffet_planner` on.

1. `/admin/buffet` → tab **Staff meals** → New staff plan → Add weekday × meal covers → Save
2. Create a second plan → first becomes inactive → **Make active** on the first → covers-rollup uses that plan again
3. Change overlap mode/% → live preview updates before Save (sample 1000/200/100); Save overlap persists outlet override
4. Composition forecast includes staff covers (`covers-rollup.staff`)
5. `GET /api/admin/buffet/staff-plans/cost-run-export?outletId=&foodUsageAzn=1000&posAttributedAzn=200&staffGrossAzn=100` → `staffNet + buffetCoveredFromStaff = staffGross`

Evidence: not signed — SCREEN only; not SHIPPED / not sellable.

## FNB-BUFFET-COST-01 — Comps / zero-price POS (Wave 4) — open

Prerequisite: module `fnb_buffet_planner` on; closed tickets in range (optional: line with `unitPriceAzn=0`).

1. Floor or API: close a ticket that includes a **zero-price** line with `recipeSku` set
2. `/admin/buffet` → tab **Cost run / comps** → set dates + optional default unit COGS → Refresh (AZN drafts do not auto-fetch until Refresh)
3. COMP bucket shows AZN / line count; sale + COMP = POS total; residual = usage − attributed
4. Clear default unit COGS → Refresh → `MISSING_UNIT_COGS` (or omit param); invert from/to → client + API 400
5. `POST /api/admin/buffet/cost-run-export` with `unitCogsBySku` → `pos.compAttributedAzn` named; missing SKU → `warnings[]`
6. Fixture: `__tests__/fnb-buffet-comp-attribution.spec.ts` — COMP not silent residual-only

Evidence: not signed — API/SCREEN; Finance FOOD usage report still open; not SHIPPED / not sellable.

## FNB-BUFFET-COST-01 — Finance HYBRID FOOD cost run (Wave 5 + Phase C) — open

Prerequisite: Finance migrate `20261028220000_warehouse_cost_class_outlet_scope`; at least one warehouse `costClass=FOOD` (optional `satelliteOutletCode`); inventory module on.

1. Finance `/inventory/settings#warehouses` → set `costClass` via CatalogField (+ outlet code) → `/inventory/buffet-food-cost`
2. Preferred: F&B Cost run → **Open Finance HYBRID** (Phase A handoff autofill + auto-run). Phase C: kit Field form; handoff strip; **no JSON** on primary path; bucket cards + attributed breakdown; Unlock overrides for theo.
3. Theoretical by SKU from handoff `theoSku` (read-only). Advanced JSON collapsed for debug only.
4. No COMPLETED stocktake → amber **ISSUES_ONLY** banner + stocktake / WH links
5. Note: Nafta à-la-carte still day document — this is FOOD attribution only
6. Fixture: `era-finance-core/apps/api/__tests__/buffet-food-cost-run.math.spec.ts`

Evidence: not signed — API/SCREEN; Phase C polish UAT open; not SHIPPED / not sellable.

## FNB-BUFFET-COST-01 — Forecast pack + non-FOOD budget (Wave 6) — open

Prerequisite: migrate `20261028230000_fnb_buffet_guest_nights`; TABLEWARE stocktake default `EVERY_15_DAYS` on `/admin/settings`.

1. F&B `/admin/buffet` → **Forecast pack** → enter guest nights for a date → Save night
2. Set key SKU norms (qty/AZN per night) → Save norms → Refresh → band LOW/MID/HIGH + forecast lines
3. Optional override period total via query/`guestNights` → band changes
4. Covers-rollup for that date shows `hotel.guestNights` (not summed into meal forecastTotal)
5. Finance `/inventory/buffet-food-cost` → **Non-FOOD budget** → Field plan AZN for CHEMICAL/CONSUMABLE/TABLEWARE/INVENTORY_GT → Save plan (toast) → Run → fact vs plan (Run alone does not wipe plan)
6. Fixtures: `fnb-buffet-forecast-pack.spec.ts` · `outlet-budget-run.math.spec.ts`

Evidence: not signed — API/SCREEN full waves 1–6; UAT open; **not SHIPPED / not sellable**; edition unchanged.

## FNB-BUFFET-COST-01 — Chef path HYBRID handoff (Phase A) — open

Prerequisite: Waves 5–6 data (FOOD WH + Forecast norms + guest-nights); `NEXT_PUBLIC_FINANCE_WEB_URL` set; module `fnb_buffet_planner`.

1. F&B `/admin/buffet` → **Cost run / comps** → outlet + week → Refresh handoff (optional staff gross AZN)
2. Buckets show sale / COMP / staff net / theoretical + band; amber `chefWarnings` if MODEL_OFF / NO_GUEST_NIGHTS / NORMS_ALL_ZERO / etc.
3. Primary **Open Finance HYBRID** → Finance `/inventory/buffet-food-cost` with query (`posSaleAzn`/`posCompAzn`/`staffNetAzn`/`theoreticalAzn`/`theoSku`) — **no JSON textarea** on primary path
4. Finance auto-runs once; FOOD usage from warehouses; Advanced JSON stays collapsed
5. Empty FOOD WH → amber settings link; `ISSUES_ONLY` → amber reliability callout; theo=0 from handoff → Forecast hint
6. Fixture: `__tests__/fnb-buffet-hybrid-handoff.spec.ts` — theoSku + COMP in query; MODEL_OFF warning

Evidence: not signed — SCREEN handoff; still **not SHIPPED / not sellable**.

## FNB-BUFFET-COST-01 — Chef UX F&B contour (Phase B) — open

Prerequisite: Phase A handoff; module `fnb_buffet_planner`.

1. `/admin/buffet` → **Forecast pack** → add/edit/delete guest-night rows for period; add/remove SKU; edit bands; Save norms & bands → Refresh → band + forecast AZN
2. **Staff meals** → no dish-lines column; covers + overlap only; honest «composition later» copy; overlap save still works
3. Open a plan composition → **covers rollup card** shows plan / management / staff / hotel nights (separate) + meal forecastTotal
4. **Cost run** → bucket cards + Open Finance HYBRID (Phase A)
5. Fixture: `__tests__/fnb-buffet-forecast-pack.spec.ts` band overlap / duplicate SKU guards

Evidence: not signed — SCREEN; still **not SHIPPED / not sellable**.

## FNB-BUFFET-COST-01 — Finance report polish (Phase C) — open

Prerequisite: Phase A handoff query (or manual Run); FOOD WH tagged.

1. Open Finance `/inventory/buffet-food-cost` with handoff → readable HYBRID: 5 bucket cards, attributed breakdown, WH strip; Advanced JSON stays collapsed
2. Force ISSUES_ONLY (no stocktake) → amber banner + stocktake / `#warehouses` links
3. Zero FOOD WH → callout → settings CatalogField costClass=FOOD → re-run shows usage
4. Non-FOOD tab: Field plan grid → Save plan (toast) → Run → fact/variance; Run alone does not wipe plan
5. Locale smoke: switch az/ru on new Finance strings

Evidence: not signed — SCREEN; still **not SHIPPED / not sellable**.

## FNB-BUFFET-COST-01 — Chef demo path (lab seed) — open

Prerequisite: Phase A–C on branch; lab org ERA ID **100000**. Seed printout week Mon–Sun (Asia/Baku).

1. Run seeds (see [`docs/SETUP_AND_RUN.md`](../../docs/SETUP_AND_RUN.md) § Buffet cost lab demo):
   - `npm run db:seed:demo` then `npm run db:seed:buffet-demo` (F&B) — confirm `fnb_buffet_planner`, outlet `NAFTANI` (never `RESTAURANT`), MID nights (~180), HYBRID
   - Finance `npm run db:seed:buffet-demo` with matching `SEED_BUFFET_OUTLET_CODE` — FOOD WH + usage; optional `SEED_BUFFET_ISSUES_ONLY=1`
2. Login F&B owner → `/admin/buffet` → Settings HYBRID → **Forecast** / **Staff** / plan **covers rollup** (Phase B)
3. **Cost run** → Refresh handoff → **Open Finance HYBRID** (Phase A) — no JSON paste
4. Finance FOOD buckets + reliability (Phase C); Non-FOOD plan/fact nonzero from seed `outletBudget`
5. Optional: re-seed Finance with `SEED_BUFFET_ISSUES_ONLY=1` → ISSUES_ONLY banner path
6. Twin steps: [`era-finance-core/doc/UAT-SMOKE.md`](../../era-finance-core/doc/UAT-SMOKE.md) § Buffet FOOD cost (lab seed)

Evidence template (unsigned until human walkthrough): [`reports/fnb-buffet-cost-lab-signoff.md`](../../reports/fnb-buffet-cost-lab-signoff.md). Waves 1–6 remain open until signed. Lab seed ≠ Pilot field ≠ SHOW/SHIPPED/`ga`.

## Quartet (Track C)

1. `GET /api/outlets` + `POST /api/outlets/select` â€” multi-outlet session
2. `POST /api/tickets/room-service` â€” room service ticket without table
3. Walk-in: `POST /api/tickets` `{ "walkInLabel": "Guest", "serviceChannel": "WALK_IN" }`
4. E8: `STOCK_CONSUMPTION_ENABLED=true` â†’ pay dispatches consumption event
5. `/admin/integration` â€” billing snapshot read-only

## Pass criteria

- `npm run build` succeeds
- Flows 1â€“9 complete without blocking errors
- With `HOTEL_PMS_URL` set, room charge appears on PMS folio (see [era-hotel-pms UAT Â§11](../../era-hotel-pms/doc/UAT-SMOKE.md))

## v1.1 — M14 (DONE)

- [x] `POST /api/labor/clock` PIN clock-in/out

## FNB-AUD-01 — Mutation audit Layer A (open — not SHIPPED)

1. Manager with `screen:admin.settings` voids a ticket line (or any successful POST) → open `/admin/audit` → entity type **HTTP mutations (Layer A)** → row shows method + path (`GET /api/admin/audit`).
2. Filters: entityId / action / userId / date range work; TicketLine shows Layer B void; **Ticket** filter shows PAY / DISCOUNT / ROOM_CHARGE / DEFER_HUB; **POS shift** shows OPEN/CLOSE.
3. Login/logout must not appear under HTTP_MUTATION.

## Deny (Scaffold BE negative paths)

1. **Module off → 403:** With `industry_fnb_pos` inactive for the session org, operational routes (module gate inside `getSatelliteSession()`) return **403** (`Industry module not active: industry_fnb_pos`). Proof: `__tests__/fnb-pos-negative.spec.ts` (+ inv/labor suites).
2. **Foreign / empty org:** Unbound satellite (no CP bind, no env org) fails closed — same 403 path; list/mutation does not silently serve another tenant’s data.
3. **Domain denies:** CLOSED ticket refuses line/fire mutations; hotel-folio settlement blocks cash pay; VOID lines excluded from stock consumption; wrong PIN → 401 on `/api/labor/clock`.

## ERA Kafe (street café on SHARED F&B pool)

1. Orch `/kafe` is **chromeless**. Signup: labelled fields; Gate locked 29 AZN; Zal/KDS/QR default off. `POST /v1/public/kafe/onboard` creates `subscriptionPlan=kafe`, F&B owner local login (email + password), outlet `KAFE`. Browser SSO to the pool; fallback `/login?org=`.
   - **Lab firm (after seed):** CP `owner@demo.com` / `12345678`. F&B `/login` `owner` / `12345678` + ERA ID **100000**. PIN cashier `1111`, waiter `2222`. VÖEN `0123456789`.
   - Workspace for ERA ID **100000**: F&B tile **Open** (not «Modul əlavə et»). Seed must have `industry_fnb_pos` in `OrganizationSubscription.activeModules`.
2. Owner `/login` (password) ≠ cashier `/pin`. A floor tablet is paired on `/pin` by the owner or manager (login, password, ERA ID). That does not open the owner cabinet. Staff then pick their name and PIN. Pairing lasts until Z-close or 18 hours. Five wrong PINs lock that person for 15 minutes. New roster PINs are 6–8 digits; the lab PINs `1111` and `2222` still sign in. Çıxış from a PIN session returns to the name list. Çıxış from an owner password session on a paired tablet opens `/login`, and the next protected page without a session also opens `/login` (not `/pin`) for ten minutes or until someone opens `/pin`.
3. Floor is one till: shift strip, tables on the left (when the outlet has more than one hall group, hall chips (from hall records, not typed zone text) sit under Take away and filter the cards; a chip shows how many tables are occupied; DOLU shows the open total and open time; one open check is shown on the right immediately), categories stacked beside the dish tiles in one block, check on the right (name, qty, price, amount, total at the bottom right). Same dish tap increases qty; minus or the trash icon removes a line. Cash (with received/change), card, and transfer pay, and cancel, are on the check. A check cannot be opened or paid without an open shift (`SHIFT_REQUIRED`). X on the strip, and Z-close plus safe drop when the signed-in role has close-shift, use the same closed-check rows as `/sales`. Z asks for counted cash (expected = opening float + cash sales − safe drops) and still closes when the count differs. Safe drops are recorded on the open shift. The journal “today” follows the business-day start hour, not midnight. A cash check stores tendered amount and change. The journal shows one cash strip per closed drawer above the checks, not as check rows, and the footer includes other tenders (nav item above Access). `/sales` filters date (Asia/Baku, default today), dine-in vs take away, tender, and drawer; a row opens the check lines with open and close times, who closed the check, and who opened it when that is someone else. A shift opened before the outlet business-day start (settings, default 05:00 Asia/Baku) still pays open checks and refuses new ones until Z. Hotel banquet stays hidden (`hotelMode=false`).
4. Cashier PIN pays; waiter PIN cannot settle (403 `FNB_WAITER_NO_PAY`).
5. Optional Zal/KDS/QR SKUs; QR `/m/{slug}` is read-only (POST 405).
6. Excel `/api/menu/export` includes price history; suggest `/api/menu/suggest?q=`.
7. Offline pay queues when network is down; replay on `online`.
8. **Edition + halls (FNB-09):** owner `/admin/settings` shows Edition `ERA Kafe` and Halls `Café`; the Halls edit button is hidden (one selectable hall). Sidebar paints once from `/api/auth/me` (no flash of other links); `/kds` appears only when `fnb_kitchen_kds` is on.
9. **Upgrade (FNB-10):** CP owner `/settings/subscription` → F&B edition card → upgrade → confirm. Workspace price lines unchanged (Foundation still waived). After Sync, F&B `/admin/settings` shows Edition `Full F&B`, Halls `Café` still on; Halls modal (multi-select) adds `Restaurant`; after save the sidebar is the union of both halls. Banquet halls and hotel room charge stay off (`hotelMode=false`).
10. **Access refresh:** `/admin/access` → refresh session → sidebar re-reads grants without a page reload.



