# FO morning — physio form / tariff questions (2026-09-04)

**Status:** answered + applied (second pass same day).

**Context**

- Canon: `era-clinic/doc/physio-site-canon.md`
- WO IR/Sollyuks: `era-clinic/doc/_tmp_infra-sollyuks-substance-hits.md`
- Reconcile: `era-clinic/doc/wo-fields-reconcile.html`

---

## Locked answers

| Topic | Decision |
|---|---|
| SMEAR / Aplikasiya | Paid smear = **Aplikasiya Naftalan ♀/♂** (`SVC-APLIKASIYA-NAFTALAN-QADIN` / `-KISI`). Not a flag on immersion bath. Same gender day windows + **shared CAB-VANNA-\*** pool as baths |
| Bath form | sit/full + DAY_BLOCK only (no SMEAR) |
| 4-chamber naftalan | no SMEAR flag (smear = Aplikasiya SKU) |
| DAY_BLOCK values | **günaşırı / 2 / 3 / 5** (`ALTERNATING`, `2`, `3`, `5`) |
| DAY_BLOCK scope | **Naftalan family only** (bath + aplikasiya). Not paraffin / darsonval / SIS |
| İK / Sollyuks + oil | Field on order (`SUBSTANCE` + `EXTRA_OIL`); all body zones OK |
| Lamp count 1/6 | **Not used** — no order field; packages irrelevant for form |
| İşıq | ≠ İK; smear + light cabin; anatomical sites; no intensity field from WO |
| Turunda | **Burun** and **qulaq** only. Combined SKU **removed** from procedure-types (legacy import → burun alias) |
| Traksiya | **Added** `SVC-TRAKSIYA` |
| Triqqezonalar | Skip / low priority (SKU may remain; WO empty) |
| Import BOTH/FULL | OK |
| Bio/relax/köpük | No service |
| Ultrafanofarez | → UFF (≠ UFB) |

---

## Engineering applied

- Gate: DAY_BLOCK only naftalan; aplikasiya + IR/Sollyuks/İşıq oil fields; turunda split sites
- Seed: aplikasiya ♀/♂, traksiya; combined turunda dropped; demo appts remapped to turunda burun
- `seed-planning-rules.cjs`: shared LOCATION requirements ♀/♂ bath + aplikasiya → `RES-VANNA-1..4-*`
- Rotation group includes aplikasiya ♀/♂
