# ADR: Clinic physio / sanatorium site catalog (S)

**Status:** Accepted — 2026-08-25; electro occupancy revised 2026-08-26; W1 schema + SatAdmin 2026-08-27; W3 type-gated fields 2026-08-27; W4 unmatched queue 2026-08-27  
**Apps:** `era-clinic`  
**Related:** [managed-lists-vs-enums.md](./managed-lists-vs-enums.md) · [clinic-icd10-catalog.md](./clinic-icd10-catalog.md) · [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md)

Canon (product + UI + unmatched): [era-clinic/doc/physio-site-canon.md](../../era-clinic/doc/physio-site-canon.md).  
Zone table: [era-clinic/doc/physio-zone-s-catalog.md](../../era-clinic/doc/physio-zone-s-catalog.md).

## Context

Nafta WO stores procedure site as free-text `nahiye` (~50k filled rows, ~2 200 unique strings) plus a 19-row `BodyParts` pick-list. ERA today has a coarse `ClinicLookup` kind `BODY_PART` (HEAD/NECK/BACK/…) and a **single** `ProcedureOrder.bodyPart`. That is too coarse for sanatorium physio and cannot represent multi-site + `növbəli`.

ICD-10 is diagnosis, not anatomy. Full SNOMED CT is not the engine (AZ affiliate cost; GPS has no hierarchy). FMA/TA is an underlay, not the doctor picker.

## Decision

1. **Doctor picks S** — a closed CIS protocol catalog (~31 codes: USSR 817 massage units, Shcherbak collar/panty, hydro fill, local coccyx/ear). Autocomplete searches az/ru/en/la **and** WO aliases. Chip shows locale + Latin.
2. **A (FMA/TA) is pre-bound** under each S. Not picked on the visit. Optional nullable `snomedId` later (GPS), not required to ship.
3. **Coarse `BODY_PART` stays** for rotation, contraindications, and `BodySilhouette`. Each S rolls up to 1–2 coarse codes. Do not replace contraindications with 31 S chips.
4. **One order, many sites** — `ProcedureOrder` gains an ordered site list (not one string). `növbəli` is `siteApplyMode=TURN` on that list (same slot). `sequenceIndex` remains program FIFO of procedure **types**.
5. **Not S** — laterality; Amplipuls work-kind I–V (`4 cu rej`); named stim program (`tenslə`); electrode count (`4 lü`); MHz/pulse; electrophoresis substance; spine level (`L4–L5`); day-block (`3 gün`/`5 gün`); bath sequence; smear. Managed lists (`CatalogField`), not free text. Shown only when the procedure type needs them.
6. **Synonyms, not extra S** — sock/glove aliases of foot/hand; Nafta `boyun` aliases collar (trapezius/scalenus). `4 lü` is not work-kind IV. Typo table is import/search only — never a doctor menu item.
7. **Unmatched WO is first-class** — never drop raw `nahiye`. Mapped codes + residue queue + SatAdmin synonym review. Unknown anatomy does not mint a new S without review.
8. **Every order has free-text `note`** — `ProcedureOrder.note` is always on the form (ozone and Massaj 30 included). Import copies WO `nahiye` into `note`; the matcher fills `sites[]` / order fields from that text; leftover and doctor comments stay in `note`. Chips remain the site control — `note` is `FREE_TEXT`, not a pick-list.
9. **Seed JSON is not runtime SoR** — `prisma/seed-data/nafta/physio-zones-s.json` feeds the lookup once. After seed, SatAdmin + DB own the catalog.
10. **Electro occupancy (planning)** — four boxes, six couches: BTL 4000 between 7∥8 and between 10∥11 (2 paws per output; **any** electro procedures in parallel, same or different — med brother 2026-08-26); UNISTIM 5S on 12 and BTL 4825S Premium on 13 (4 paws each, also usable as 2-pad; US on 4825S unused). Placement is **FIFO only** (`placeConfirmedProcedures`): 12/13 are ordinary 2-pad resources — do not hold them for `4 lü`. `4 lü` / 4-pole IFC may land only on 12 or 13 when free (capability, not priority). Cabin 14 not in ERA. US/UFF stays 15–17. One electro nurse on all six couches. Separate ProcedureTypes, shared resources. Not schema until the resource wave. Cutover `#40` LOCATION pool remains 7–13.
11. **Device programs and substances are SatAdmin catalogs** — `PhysioListItem` (`DEVICE_PROGRAM` | `SUBSTANCE`) + aliases. Do not hardcode Select options; the WO tail is open-ended. Not stuffed into thin `ClinicLookup`.

## Explicitly out of scope (this ADR)

- Full 2D body-map SVG (chips first; map later).
- SNOMED CT as the site engine.
- Mixing ICD-11 anatomy into the ICD-10 diagnosis catalog.
- Auto-minting a new S from the unmatched queue (alias existing S only).
- Electro 2/4-pad cabin routing (canon §9 / planner).

## Consequences

- Schema: `PhysioSite` + aliases; `PhysioListItem` programs/substances; `procedure_order_site` + `siteApplyMode`; `ProcedureOrder.physioFields` + per-site laterality; keep raw import text on `ProcedureOrder.note`.
- Import: matcher on `#23` slots (`nahiye` → `note` + `sites[]`); unmatched/partial → `PhysioNahiyeQueue`; SatAdmin `/admin/physio-sites` Unmatched tab aliases existing S only. Coverage CLI `nahiye-s-match.cjs` remains offline SoR (golden vs domain TS).
- Coverage/acceptance: CLI-49 **SHIPPED** for SatAdmin catalog + doctor chips + type-gated fields + unmatched queue (W4). UAT-SMOKE CLI-49 still open → Product-Readiness SCREEN. CLI-49 stays out of BE Implementation-Matrix rollup (no Scaffold ✅).
