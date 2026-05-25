# Nafta sanatorium — Wave 3 traceability

Elektraweb analysis (NotebookLM, ~1000 screens) mapped to ERA satellites. Full screen dump omitted; see clone-spec and reference catalogs.

## P0 modules → implementation

| Module | Elektraweb analogue | ERA owner | Wave 3 step | User stories |
|--------|---------------------|-----------|-------------|--------------|
| SAN-PKG | Medical package / Route To Board Folio | era-hotel-pms | HN-1 Stage 18 | US-01, US-05 |
| PROC-SCHED | Spa Reservation List | era-hotel-pms | HN-2 PROC-SCHED | US-03, US-08 |
| MEDICAL-REC | Guest medical card, Lab Test Results | era-clinic | HN-3 K5 | US-06, US-07 |
| FB-POS | Restaurant room charge | era-fb-pos | HN-4 (regression) | Stage 17 |
| FOLIO | Night audit / EOD | era-hotel-pms | HN-1 EOD | US-05 |
| MDM | Global person / consent (future citizen portal) | era-365-orchestrator | HN-P | — |

## Deferred (NotebookLM — beyond Wave 4)

Stock / purchasing, full CRM surveys, loyalty, LIS/HL7, SPA recipes → stock, citizen portal UI.

**Wave 4 (done):** transfers (HN-7), banquets (HN-8).

**Wave 5 (active):** finance GL bridge, invoice/agency, contract pricing — [nafta_wave5_master.plan.md](../../../.cursor/plans/nafta_wave5_master.plan.md).

## Open questions — recorded defaults

| # | Question | Default (Wave 3) |
|---|----------|------------------|
| Q1 | Folio routing / tax split for package components | Single guest folio; package lines split by revenue code (ROOM/TREATMENT/BOARD); virtual company split deferred |
| Q2 | Doctor free-text notes vs ICD-only | Both: `ClinicalComplaint` text + `ClinicalDiagnosis` with optional ICD code |
| Q3 | Lab LIS integration | Manual entry (clinic K2 pattern); min/max on result lines |
| Q4 | SPA recipe → stock | Out of scope; optional event stub only in Phase 2 stock |

## Wave 4 backlog (plan update)

| Module | Elektraweb | ERA owner | Plan step |
|--------|------------|-----------|-----------|
| Airport transfers | WA0143, WA0227, WA0085 | hotel-pms | HN-7 |
| Banquets BEO | SalesMarketing, WA0231 | hotel-pms + fb-pos | HN-8 |
| Full manifest ~1500 | all screens | doc/nafta | HN-N via [NOTEBOOKLM-PROMPT.md](./NOTEBOOKLM-PROMPT.md) |

## NotebookLM import (HN-N)

| Artifact | Status | Path |
|----------|--------|------|
| Core screens sample (14) | imported 2026-05-25 | [screens-manifest-v2-core.json](./screens-manifest-v2-core.json) |
| Modules matrix | imported | [modules-priority-matrix.json](./modules-priority-matrix.json) |
| Process catalog (40) | imported | [process-catalog.md](./process-catalog.md) |
| User stories | imported | [user-stories-index.json](./user-stories-index.json) |
| Open questions | imported | [open-questions-nafta.md](./open-questions-nafta.md) |
| Summary stats | imported | [summary-stats.json](./summary-stats.json) |
| Full ~1243 screens JSON | **pending** | merge batches or CSV parser — see [NOTEBOOKLM-IMPORT.md](./NOTEBOOKLM-IMPORT.md) |

Legacy v1: [screens-manifest.csv](./screens-manifest.csv) (292 rows).

## Evidence index

| Source | Path |
|--------|------|
| DOC-B per-step checklist | [DOC-B-CHECKLIST.md](./DOC-B-CHECKLIST.md) |
| NotebookLM prompt | [NOTEBOOKLM-PROMPT.md](./NOTEBOOKLM-PROMPT.md) |
| Clone-spec sanatorium | [../clone-spec/06-channel-crm-med.md](../clone-spec/06-channel-crm-med.md) Part C |
| Phase 2 roadmap | [../clone-spec/14-phase2-roadmap.md](../clone-spec/14-phase2-roadmap.md) |
| Nafta validation | [../clone-spec/13-nafta-validation-checklist.md](../clone-spec/13-nafta-validation-checklist.md) |
| Elektraweb modules JSON | [../data/modules-scrape-data.json](../data/modules-scrape-data.json) |
| On-buro features | [../data/on-buro-features.json](../data/on-buro-features.json) |

## Baseline

Git: `90d8319` on `origin/master` (post Wave 2). Builds: hotel-pms, fb-pos, clinic.
