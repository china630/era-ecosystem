# ADR: Elektraweb reverse folio post (Nafta dual-run)

**Status:** Accepted (v1 outbox + clinic Issue-ticket landed 2026-08-27; HOT-06 remains HEADLESS)  
**Date:** 2026-08-27  
**Scope:** `era-hotel-pms` MV3 `elektraweb-bridge` + hotel ingest/outbox; producer v1 = `era-clinic`  
**Extends:** [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md) · SaaS org-scoped config (landed Waves 1–11; sell open): [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md)  
**Print:** three-copy extra ticket — [clinic-print-forms.md](./clinic-print-forms.md) (`/print/extra-ticket/[ticketId]`; ERA combat copy at issue, not Elektraweb `saveCheck`)  
**Day-ops charge timing:** amends extra billing vs [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) (today charges on `COMPLETED`)  
**Lifetime:** dual-run of the sanatorium block until hotel hour X; **not** a product SoT  
**Coverage:** `HOT-06` remains HEADLESS

## Context

Nafta sanatorium extra procedures **never auto-posted** from WebOnly to Elektraweb. Sanatorium reception typed them into the Elektraweb **SPA module**, printed **three copies** (signed reception copy, nurse, guest), and only then sent the guest to the cabin.

Walk-in extras are **not** a per-guest Cash Office sale. They dump onto one Elektraweb house folio — **`TIBB AMBULATOR FOLIO`** / **Tibbi Ambulator FOLIO** (already listed as a system ledger in [ELEKTRAWEB-IMPORT.md](./hotel-elektraweb-import.md) §15.3). Every walk-in client’s SPA lines share that account. Operationally a mess; dual-run **copies** it so hotel FO still sees money where they look today. ERA product after hour X must **not** recreate a shared dump folio.

Clinic is moving to ERA first. Hotel FO stays on Elektraweb. Inbound live-bridge already mirrors guests / reservations / open folio **Elektraweb → ERA**. Charging extras via ERA `POST /api/pos/room-charge` on `COMPLETED` would:

- put money on an ERA folio the hotel cashier never opens;
- skip the paper ticket the nurse requires;
- miss the house folio `TIBB AMBULATOR FOLIO` (ERA hub / local cashier is the wrong till during dual-run).

Hotel FO does **not** need a ping that “clinic added a charge”. They see the SPA line on the Elektraweb folio at checkout, same as today — **if** sanatorium reception posted the ticket in Elektraweb.

## Decision

### 1. Charge at **issue ticket**, not at complete

| Event | Elektraweb folio |
|-------|---------------------|
| Doctor assigns extra in ERA | No — draft / “to pay” only |
| Sanatorium reception **issues ticket** (3 copies) | **Yes** — Insert into Elektraweb |
| Nurse check-in / `COMPLETED` | No second charge |
| Cancel extra before procedure | Void EW line + reprint / strike ticket |
| NO_SHOW on already-issued extra | No second charge; refund policy separate |
| Over-quota above package | Same “issue extra ticket” step, not a surprise on `COMPLETED` |
| Package-included in quota | No ticket, no EW post |

Walk-in vs in-house:

| Origin | Elektraweb target | Who collects money |
|--------|-------------------|--------------------|
| `IN_HOUSE` extra | SPA bulk sales → **that guest’s** folio (`RESNAMEID` on Save; hotel `RESID` on folio list) | Hotel FO at checkout |
| `WALK_IN` extra | Same SPA bulk sales → house folio **`TIBB AMBULATOR FOLIO`** (one `RESNAMEID` for all walk-ins) | Whatever they do today on that dump folio (not per-patient Cash Office) |

Same Insert contract for both: `SP_SPA_SAVE` + optional `GETPAYMENTONLY` + `saveCheck` print. Walk-in is only a **different `RESNAMEID`**, not `WALKIN` / `POSCARDID` / Cash Office.

During dual-run ERA `/cashier` and settlement hub **must not** replace this dump folio. After hour X: walk-in extras settle on a **real ERA bill** (cashier / hub), not a cloned house folio.

Prerequisite before write code: **`SP_SPA_SAVE` captured 2026-08-27** for a real guest and for Tibbi Ambulator. Nafta house keys (property `HOTELID=31606`): hotel `RESID` **66246938**, SPA `RESNAMEID` **100670215**. Resolve by inbound name match in other environments; do not hard-code these ids as product defaults. In SaaS they belong on the **hotel org policy** (Super-Admin), not process env — [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md).

### 2. Who holds the Elektraweb session

| Desk | EW + extension | Role |
|------|----------------|------|
| **Sanatorium reception** | Yes — SPA (guest folio + Tibbi Ambulator house folio) | Issue extra tickets; **drain write outbox** |
| **Hotel FO** | Yes — res / guest / folio grids | Check-in/out; **inbound mirror only** |
| Nurse | No | ERA + paper ticket |

Do **not** drain the write queue from hotel FO PCs. Silent FO drain would post folio lines without the three copies.

### 3. SoT until hotel hour X

| Contour | Dual-run SoT | ERA |
|---------|--------------|-----|
| Reservation, check-in/out | Elektraweb | inbound mirror |
| Extra SPA ticket (guest folio or Tibbi Ambulator) | Elektraweb (after ERA “Issue ticket”) | print + outbox; **no** native ERA folio post |
| Clinic episode / schedule | ERA Clinic | — |
| ERA night audit on mirrored stays | Off | — |

Exception to live-bridge “never mutate Elektraweb”: the extension may perform **one** mutation class — Insert (and later Void) of a SPA ticket from the outbox — only on a **sanatorium** desk, only when write is enabled. No DOM clicks, no reservation edits, no payments beyond that ticket.

### 4. Flow

```text
Doctor assigns extra in ERA
        ↓
Sanatorium reception: Issue ticket (one extra or a batch)
        ↓ ERA prints 3 copies (combat copy only after EW ack)
        ↓ hotel outbox (idempotencyKey = clinic-ticket-{ticketId})
        ↓
Widget on THAT PC (sanatorium desk + live EW session)
        ↓ Insert SPA: guest RESNAMEID (IN_HOUSE) or Tibbi Ambulator RESNAMEID (WALK_IN)
        ↓ ack elektrawebLineId / doc no
        ↓ inbound Select mirrors the line into ERA FolioCharge (EW id)
Hotel FO opens EW folio at checkout — sees the line. No extra UI.
```

Clinic does not store Elektraweb ids. Hotel resolves ERA `reservationId` → stay-guest `RESNAMEID` (and hotel `RESID` on folio list). Walk-in extras use a **configured house stay**, not the clinic patient as an EW guest.

Do **not** dual-write ERA `postCharge` and EW Insert. ERA folio for that line comes from inbound upsert on EW `FolioCharge.externalRef`.

### 5. Outbox contract (hotel-pms)

Conceptual row `ElektrawebFolioOutbox`:

| Field | Meaning |
|-------|---------|
| `source` | `CLINIC` \| `FNB` (F&B producer later) |
| `idempotencyKey` | unique; clinic ticket id |
| `settlement` | `ROOM_FOLIO` (guest stay or Tibbi Ambulator house stay) |
| `reservationId` | ERA UUID of the **target stay** (guest, or house folio) |
| `elektrawebResNameId` | SPA Save key; denormalized at enqueue |
| `amount` / `description` / `revenueHint` | `MEDICAL` / later `FOOD` |
| `elektrawebRevId` | from Hizmet / `SPA MEDIKAL` crosswalk |
| `status` | `PENDING` \| `SENDING` \| `POSTED` \| `FAILED` \| `CANCELLED` |
| `elektrawebLineId` | after success |

Widget API (same bridge JWT as ingest):

- `GET …/elektraweb-bridge/outbox?status=PENDING`
- `POST …/elektraweb-bridge/outbox/:id/ack`

Fat server builds the Insert payload; thin extension only `fetch`es it with the page `LoginToken`.

Catalog crosswalk is a hard gate: unknown `REVID` → `FAILED`, never a guess line.

### 6. Extension settings UI (landed)

Options page (open in tab) is the operator control surface — not a SatAdmin hotel screen.

| Setting | Storage key | Meaning |
|---------|-------------|---------|
| Locale | `locale` | `en` \| `ru` \| `az` |
| ERA Hotel URL + login | existing | bridge JWT |
| Desk | `deskRole` | `hotel_fo` \| `sanatorium` |
| Inbound capture | `enabled` | Select JSON → ERA ingest |
| Write / outbox drain | `writeEnabled` | SPA Insert (guest or Tibbi Ambulator); **ignored unless** `deskRole=sanatorium` |

Popup: compact status + same toggles + open settings. Sanatorium drain is live when `ELEKTRAWEB_BRIDGE_WRITE_ENABLED=1` and the extension has a page `LoginToken`. Insert shape is `SP_SPA_SAVE` for both origins; Nafta walk-in target is house `RESNAMEID` 100670215 (`RESID` 66246938). ERA prints 3 copies at issue (combat copy); Elektraweb `saveCheck` is not driven by the widget.

### 7. Observability (not an EW checkout lock)

Elektraweb cannot block checkout on our queue.

- Extension badge / settings: pending age, last error.
- Hotel `GET …/health`: inbound + `writeEnabled` + outbox counts by status.
- Operational rule: do not check out an in-house stay with clinic extras while sanatorium write health is red / pending &gt; N minutes.

Manual Quick Posting remains **fallback** on `FAILED`, not the happy path.

### 8. Hour X (hotel cutover)

1. Soft-freeze extra tickets; drain outbox to 0 (or manual fallback).
2. `writeEnabled=0` on all sanatorium PCs; `ELEKTRAWEB_BRIDGE_WRITE_ENABLED=0` on server.
3. Clinic “Issue ticket” switches to native ERA folio / cashier; **keep 3-copy print**.
4. Inbound last sync → `ELEKTRAWEB_BRIDGE_ENABLED=0`; uninstall; revoke tokens.
5. Outbox retained for reconciliation; no new rows.

### 9. Non-goals

- Paid Eptera API.
- Hotel FO write drain or FO “new clinic charge” inbox.
- Dual-write ERA folio + EW.
- Walk-in hub / clinic cashier as a substitute for `TIBB AMBULATOR FOLIO` during dual-run.
- Cloning the dump folio as ERA product SoT after hour X.
- F&B producer (enum slot only).
- Chrome Web Store.

## Consequences

**Positive:** sanatorium stops re-typing extras in EW; hotel checkout still sees SPA lines on the guest folio or Tibbi Ambulator; paper 3-copy process preserved; one Insert path for in-house and walk-in.

**Negative / risks:** write depends on a live sanatorium EW session; Insert contract is version-fragile; unknown SPA product fails enqueue (422); IN_HOUSE extras 409 until inbound stamps `elektrawebResNameId`.

**Follow-ups (not v1):** batch several extras into one `DETAILDATA`; print only after outbox `POSTED`; Void + cancel ticket; Elektraweb `saveCheck` 3-copy.

## Implementation status

| Piece | Status |
|-------|--------|
| This ADR | Accepted (dual-run only; not product SoT) |
| Extension settings UI (desk, inbound, write toggle, locale) | Landed 2026-08-27 |
| In-house SPA Save discovery (`SP_SPA_SAVE` + `saveCheck` print) | Landed 2026-08-27 (CDP listen) |
| Walk-in target | House folio `TIBB AMBULATOR FOLIO` — Nafta `RESID` 66246938 / `RESNAMEID` 100670215 |
| House folio `RESNAMEID` | Landed 2026-08-27: Nafta `RESID` 66246938 / SPA `RESNAMEID` 100670215 |
| Outbox API + widget Insert | Landed 2026-08-27 (`ElektrawebFolioOutbox` + `SP_SPA_SAVE` drain) |
| Clinic Issue-ticket + 3-copy print + nurse gate | Landed 2026-08-27 (`/reception/extra-tickets`; ERA print at issue, not after ack) |
| SaaS: Super-Admin per-org policy + request tenant (no property env) | Landed Waves 1–11 — field HOT-06 SHIPPED / pool sell still open — [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) |

## References

- Inbound bridge: [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md) · [ELEKTRAWEB-LIVE-BRIDGE.md](../../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md)
- Bootstrap keys: [hotel-elektraweb-import.md](./hotel-elektraweb-import.md)
- Settlement hub (do **not** use for dual-run extras): [unified-settlement-hub.md](./unified-settlement-hub.md)
- Native ERA extra charge today: `era-clinic` `procedure-completion.service.ts` / `billing-router.ts`
- SaaS pool / Super-Admin org policy: [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md)
