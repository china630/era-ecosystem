# Nafta P4 — B2B / MICE gate decisions

Recorded for Wave 4 dev defaults. Confirm with Nafta on site; update [open-questions-nafta.md](./open-questions-nafta.md) when answers change.

## Gate questions

| # | Question | P4 default (dev / sanatorium pilot) | Implementation |
|---|----------|-------------------------------------|----------------|
| 1 | Allotment/block contracts vs discount-only? | **Both supported**; Nafta sanatorium pilot ships **discount + optional nightly quota** per room type | `SalesContract` + `ContractAllotment`; BAR hidden when booking under ACTIVE contract rate plan |
| 2 | Contract advance: folio deposit vs Finance bank transfer? | **Folio deposit first** (`FolioDeposit` / BEO advance pattern); Finance AR for city ledger statements only | `depositRequired` + `depositAmount` on `SalesContract`; link to P2 deposit module |
| 3 | BEO POS: extras only or full pax portions? | **Extras only** on event day; base package total on PMS master folio | `beoId` on fb-pos tickets; package lines posted on BEO confirm |
| 4 | Corporate events: master folio (company VÖEN) or guest folio? | **Master folio** — `COMPANY` / `AGENCY` folio when counterparty has VÖEN; guest folio fallback | `BanquetEvent.masterFolioId`, `companyGuestId`, `agencyId` |
| 5 | Sales pipeline: era-crm or hotel-only? | **Hotel-only** for contract CRUD + allotment; era-crm optional lead handoff later | `/admin/contracts`; no duplicate Finance counterparty screens |

## Sanatorium scope note

If Nafta confirms **agency allotment only** (no conferences), ship **H-BL-30 (P4-1–P4-2)** and defer **H-BL-31 (P4-3–P4-5)** until first banquet sale.

## Availability priority

Documented order: **contract allotment block > OTA channel quota > BAR**.

## Related docs

- [BACKLOG-PRODUCTION.md § P4](../BACKLOG-PRODUCTION.md)
- [docs/adr/hotel-b2b-sales-contracts.md](../../docs/adr/hotel-b2b-sales-contracts.md)
- [process-catalog.md](./process-catalog.md) — PROC-24 replacement UAT
