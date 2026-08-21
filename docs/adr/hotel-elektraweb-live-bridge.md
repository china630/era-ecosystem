# ADR: Elektraweb live bridge (browser extension dual-run)

**Status:** Accepted (MVP implemented 2026-07-15)  
**Date:** 2026-07-15  
**Scope:** `era-hotel-pms` — temporary Nafta dual-run after Excel bootstrap; optional reuse for other Elektraweb → ERA cutovers  
**Related:** [hotel-elektraweb-import.md](./hotel-elektraweb-import.md) · [hotel-ota-adapter-strategy.md](./hotel-ota-adapter-strategy.md) · operator guide [ELEKTRAWEB-LIVE-BRIDGE.md](../../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md)

## Context

Nafta migrates from **Elektraweb** (Eptera, `app.elektraweb.com`) to ERA Hotel PMS + Clinic. Historical load uses the Excel import wizard ([ELEKTRAWEB-IMPORT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md)). Official Elektraweb API/export jobs are paid (~1 EUR/room/year, min 120 EUR — [vendor API page](https://www.elektraweb.com/en/api-integrations)) and are **out of scope**.

For a short **dual-run** (target ≤ 2 weeks) before hour-X cutover, reception continues to work in Elektraweb while ERA must mirror:

| Entity | Why |
|--------|-----|
| Guests | `Guest.externalRef`, MDM `globalPersonId` for clinic QR / episodes |
| Reservations | In-house / arrivals; status deltas → clinic lifecycle events |
| Folio (open lines) | Hotel mirror parity; soft cutover without another Excel open-folio dump |

Clinic already consumes hotel events (`GUEST_CHECKED_IN/OUT`, `ROOM_CHANGED`, `SANATORIUM_BOOKING_CREATED`) via orchestrator bus / clinic bridge. A raw DB upsert that skips lifecycle services would leave clinic empty.

Alternatives considered: Playwright/Puppeteer on a VM (session + Authenticator ops); nightly Excel deltas (slow, operator-heavy); paid Eptera API (rejected on cost).

## Decision

### 1. Temporary browser extension (MV3) — not a product SoT

- Chrome/Edge **Manifest V3** extension loaded **unpacked** (or private enterprise store) on Front Office PCs only.
- Scope: **read/intercept** Elektraweb XHR/fetch JSON while staff use normal UI grids; **never** mutate Elektraweb.
- Lifetime: dual-run only; uninstall + revoke ingest token at cutover.
- COVERAGE status: **STUB / HEADLESS** bridge — not SHIPPED product capability.

### 2. Elektraweb remains SoT until hour X

| Contour | System of record (dual-run) | ERA role |
|---------|----------------------------|----------|
| Reservations, check-in/out, folio posts | Elektraweb | Mirror via bridge |
| Clinic episodes / procedures | ERA Clinic | Consumes hotel lifecycle |
| Night audit / folio mutate in ERA | **Off** for mirrored stays | Enable after bridge off |

Staff must **not** edit the same stay folio/reservation in ERA UI during dual-run.

### 3. Thin extension + fat server ingest

```text
Elektraweb SPA (operator session)
  → MV3 extension (URL filter + response capture)
  → POST era-hotel-pms /api/integrations/elektraweb-bridge
  → normalize (reuse Excel externalRef keys)
  → upsert + status-diff → lifecycle emit → clinic
```

- Extension forwards **raw payloads** + request metadata (URL, method, capturedAt). Mapping/Zod lives in hotel-pms (same family as Excel adapters).
- Prefer **Network API intercept** over DOM scraping (SPA version observed: **v18.0.580** — fragile selectors).
- Idempotency: `Guest.externalRef`, `Reservation.externalRef`, `FolioCharge.externalRef` (Elektraweb Guest Id / Res Id / folio line Id).

### 4. Seed UI routes (operator entry points)

These grids are the primary surfaces operators open so the extension sees list/detail XHR (exact backend paths are discovered via HAR — see live-bridge guide §Discovery):

| Domain | Elektraweb UI route |
|--------|---------------------|
| Reservations | https://app.elektraweb.com/app/grid/res-all/reservation |
| Folio (bulk posting / lines) | https://app.elektraweb.com/app/grid/toplu-islem-girisi |
| Guests | https://app.elektraweb.com/app/grid/guest-card-simple |

### 5. Explicit non-goals

- Not a substitute for [OTA adapter strategy](./hotel-ota-adapter-strategy.md) after cutover.
- Not Chrome Web Store public distribution.
- Not full historical folio archive replay (same cutover discipline as NAFTA UAT §6.2: open / in-house focus).
- No Chart of Accounts / GL via bridge.

## Consequences

### Positive

- Dual-run without paid Eptera API; clinic can run on ERA while FO stays on Elektraweb.
- Hour-X cutover reuses live open folio + statuses already in ERA.
- Reuses Excel `externalRef` and (planned) adapter field maps.

### Negative / risks

- SPA/API shape can change with Elektraweb releases (mitigate: URL allowlist + version banner check).
- Sync only on PCs where the extension is installed and the operator opens/trigger grids.
- Security: extension sees Elektraweb cookies in-page context; harden bridge token, HTTPS-only ingest, no PII logging of raw payloads in prod.

## Implementation status

**MVP (2026-07-15):** extension + login + ingest + HOTELID/org binding. Dual-run UAT still open — see [ELEKTRAWEB-LIVE-BRIDGE.md](../../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md). COVERAGE `HOT-06` = API.

## References

- Excel bootstrap ADR: [hotel-elektraweb-import.md](./hotel-elektraweb-import.md)
- Shared twin / EW SHARE+Room Count 0 pairing: [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md) § Elektraweb cutover
- Nafta cutover scope: [NAFTA_SANATORIUM_UAT.md](../NAFTA_SANATORIUM_UAT.md) §6.2
- Clinic lifecycle consumer: `era-clinic/src/lib/lifecycle-consumer.ts`
