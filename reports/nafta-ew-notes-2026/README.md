# EW Front Office With Notes (2026) → ERA package migration

**Sources (merged by `Res Id`):**

| File | Rows |
|------|-----:|
| `Front Office With Notes.2026-08-30.13-52-50…xlsx` | 767 |
| `Front Office With Notes.2026-08-30.13-54-15…xlsx` | 690 |
| `Front Office With Notes.2026-08-30.13-54-50…xlsx` | 322 |
| **Unique reservations** | **1678** |

Artifacts: this folder (`summary.json`, `migration-rows.csv`, `migration-rows-enriched.json`, `package-stamp-candidates.csv`, `agency-sku-rule-candidates.json`).

Re-run:

```bash
node scripts/_tmp_utf8/analyze-ew-fo-notes-2026.cjs
node scripts/_tmp_utf8/enrich-ew-notes-migration.cjs
```

## 1) EW ↔ ERA note field map

| EW column (FO with notes) | Fill % (unique) | ERA `ReservationNote.noteType` | Import / bridge |
|---------------------------|----------------:|--------------------------------|-----------------|
| Extra Req | 40.4% | `EXTRA_REQ` | ✅ wide + long |
| Res Note | 39.8% | `RES_NOTE` | ✅ |
| Price Note | 81.8% | `PRICE_NOTE` | ✅ |
| CIn Note | 7.3% | `CIN_NOTE` | ✅ |
| `#COut Note#` | 1.4% | `COUT_NOTE` | ✅ (was missing from wide import) |
| Room Note | 1.0% | `ROOM_NOTE` | ✅ (was missing from wide import) |
| Cancel Note | 0.3% | `CANCEL_NOTE` | ✅ (was missing) |
| Payment Note | 0.5% | `PAYMENT_NOTE` | ✅ (was missing) |
| Invoice Note | 0.1% | `INVOICE_NOTE` | ✅ (was missing) |

**ERA-only note types** (not in this EW dump; keep for FO ops): `CONFIRMATION`, `GENERAL_NOTE`, `ARRIVAL_POSTPONED`, `DEPARTURE_EXTENDED`, `SET_ARRIVAL_EARLY`, `SET_DEPARTURE_EARLY`.

**Not notes** (stay on reservation / other columns): `Voucher`, `Special States`, `VIP`, `Accom Type`, `Agency`, guest/room dates — already mapped by FO / live-bridge adapters.

No new Prisma note-type enum values were required: all nine EW note columns already existed in `RESERVATION_NOTE_TYPES`. The gap was **import + live-bridge mapping** of COut / Room / Cancel / Payment / Invoice.

## 2) Package migration extract (deep)

### Resolve path counts (notes+agency only, live Wave A logic)

| stayKind | Count |
|----------|------:|
| leisure (`Walkin leisure`, no Extra) | 207 |
| medical (SKU resolved) | 192 |
| unresolved | 1279 |

| SKU (notes/agency) | Count |
|--------------------|------:|
| PKG-STANDART | 94 |
| PKG-PREMIUM | 53 |
| PKG-DERMO | 44 |
| PKG-DETOKS | 1 |
| ERA-PKG explicit in Extra | **4** only |

### After enrichment (agency-prefix first + Price Note + soft medical default)

| Metric | Count |
|--------|------:|
| With `migrationSku` | **1151** (**68.6%**) |
| Agency Premium/Dermo/Detoks/Həmkarlar hits | **140** (all high conf) |
| Mix hints (289/276/…) | 95 |
| Leisure skip (no med stamp) | 207 |
| Needs FO review (low/mix/default) | 707 |

| migrationSource | Count |
|-----------------|------:|
| agency-prefix | 140 |
| price-note | 790 |
| agency-medical-default (* medical → Standart, low) | 167 |
| phrase / ERA-PKG | 54 |
| price-mix / mix-hint | 52 |

| migrationSku | Count |
|--------------|------:|
| PKG-STANDART | 931 |
| PKG-PREMIUM | 149 |
| PKG-DERMO | 70 |
| PKG-DETOKS | 1 |

**Apply rule:** `migrationConf=high` + `agency-prefix` / phrase / ERA-PKG / catalog price → auto-stamp. `agency-medical-default` and `low` → FO queue. `mixHint` → Guests tab dual SKU.

## 3) How to apply into ERA

1. Import FO reservations (existing adapters) so `externalRef = Res Id`.
2. Import this dump via **Reservation notes** wizard (`reservation-notes` adapter) — now all nine note columns.
3. Run medical stamp (adapter already calls `stampMedicalPackagesForReservation`).
4. Optionally FO-apply `package-stamp-candidates.csv` high-confidence `migrationSku` where resolve left unresolved (scripted upsert of `ReservationGuest.medicalPackageCode` + `syncComposedDailyRates`) — **do not** bake price→SKU into live `resolveMedicalSku` (BAR/discount bleed).

## 4) AgencyMedicalSkuRule candidates

See `agency-sku-rule-candidates.json`. Keep SatAdmin editable; seed defaults already cover Premium/Dermo/Detoks/Həmkarlar prefixes.
