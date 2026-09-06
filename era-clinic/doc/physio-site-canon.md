# Physio / sanatorium sites (S) — product canon

**Status:** W3 — SatAdmin catalog + `sites[]` + doctor chips + type-gated order fields. Unmatched import queue is W4.  
**ADR:** [clinic-physio-site-catalog.md](../../docs/adr/clinic-physio-site-catalog.md)  
**Zone table:** [physio-zone-s-catalog.md](./physio-zone-s-catalog.md)  
**WO coverage:** [physio-zone-s-coverage.md](./physio-zone-s-coverage.md)

If this file and the seed JSON disagree, **this file wins**. JSON is a seed draft.

## 1. What the doctor picks

| Layer | Who | What |
|-------|-----|------|
| **S** | Doctor / reception | ~31 protocol sites (CIS spa: 817 + Shcherbak + hydro + local) |
| **A** | System | FMA/TA underlay on each S (Latin, export). Not a visit picker |
| **Coarse `BODY_PART`** | System | HEAD/NECK/BACK/… derived from S — rotation, contraindications, silhouette |

UI: `CatalogField` SEARCHABLE / MULTI chips. Locale title + Latin on the chip. Search az, ru, en, la, and hidden WO aliases. No free-text `nahiye` as the permanent control.

## 2. Seed vs runtime

| Artifact | Role |
|----------|------|
| `prisma/seed-data/base/physio-zones-s.json` | Satellite base: 31 S codes (no WO aliases) |
| `prisma/seed-data/nafta/physio-zones-overlay.json` | Nafta org overlay: WO aliases + matcher extras |
| Merged via `physio-catalog-layers` | Matcher / coverage input. Not product SoR after DB load |
| Clinic DB lookup + alias rows | Runtime SoR (SatAdmin can add synonyms, not invent anatomy) |
| Raw WO `nahiye` on imported orders | Audit shadow — never discarded |

## 3. S catalog (shape)

~31 codes. Full titles/aliases: zone table. Laws:

- **Sock / glove** = synonyms of **foot / hand** (`ZONE-FOOT-LEG` / `ZONE-HAND-FOREARM`). Not a separate S, not a “cut” field.
- **Nafta `boyun`** = **collar** (trapezius / scalenus). `ZONE-NECK` stays 817 §3 for explicit neck-only; no WO alias `boyun`.
- **Coccyx** is its own S. `bel oma` does not include it.
- **Panty (Shcherbak)** ≠ sitz bath ≠ hip joint — three codes.
- **Naftalan fill (practice):** values `TAM` | `OTURAQ` | `QURSAQ` on order field **`NAFTALAN_FILL`** (closed select). Matcher also maps bare `tam` / `oturaq` / `qurşaq` → chips `ZONE-FULL-BODY` / `ZONE-SITZ` (+ fill field). Multi-day «1 ci oturaq son tam» stays **`BATH_SEQUENCE=SITZ_THEN_FULL`** only — do not set `NAFTALAN_FILL` for that phrase. Four-chamber is a **different procedure** (`ZONE-FOUR-CHAMBER`), not a fill.
- **`belinə` / `beline`** → **`ZONE-LUMBOSACRAL`** (same as `bel`).
- **`ayaqlara qarina`** = legs + abdomen (`ZONE-LOWER-LIMB` + `ZONE-ABDOMEN`). `qarina` is dative of `qarın`.
- **`böyrəküstü` / `böyrək üstü` / `öyrəküstü`** = lumbar / above the kidneys → **`ZONE-LUMBOSACRAL`**. Not a new S.
- **`şanaq` / `sanaq`** = `çanaq` → **`ZONE-HIP-GLUTEAL`**.
- **`boyun yuxari bel` / `yuxari boyun`** on Parafin Yuxarı: `yuxarı` echoes the SKU. Sites are collar (+ lumbar if `bel`). Not upper limb.
- **`qollardan aşağı`** on Parafin Yuxarı + `tam onurğa` = distal to the upper arm → **`ZONE-HAND-FOREARM`** (forearm/hand), simultaneous with spine.
- **`her iki bizler`** = `hər iki diz` → **`ZONE-KNEE`**.
- **`diz oynagi` / `dizətrafi`** = knee joint / peri-knee → **`ZONE-KNEE`**. Not a ligament S. **`dizəqədər`** = to the knee → **`ZONE-FOOT-LEG`**.
- **`neloma` / `meloma`** = `beloma` (keyboard n/m vs b) → **`ZONE-LUMBOSACRAL`**. Not melanoma.
- **`dizdən aşağı`** = below the knee → **`ZONE-FOOT-LEG`**. **`dizaltı`** = under the knee → **`ZONE-KNEE`**.
- **`ekstremite`:** `aşağı/alt` → lower limb; `yuxarı` → upper limb; bare = both arms+legs. Not a new S.
- **`furun`** = nose (`ZONE-FACE`). **`raloji rej`** on Elektroforez = **`nevraloji`** program, not radiology.
- **`baldır`** = crus (`ZONE-FOOT-LEG`). **`bud` / `quadriseps`** = thigh → **`ZONE-HIP-GLUTEAL`**. Bare `biceps` is not arm (with quad = biceps femoris).
- `artroz pr` / `ödem pr` / `dermo rej` / leftover `art` / `(b)`/`brej` = **device/laser program**, not PRP and not S.
- **`turunda` / `tampon`** = tampon procedure, not a site. **`çoban yastığı`** = chamomile additive.
- **`qoltuqaltı`** → upper limb (no axilla S). **`dumbek` / `sakrum`** = sacrum → **`ZONE-LUMBOSACRAL`**. **`oma`** = same. **`sargi` / `sagir nah`** = bandage, unmatched. **`sagri`** = **sağrı** (haunch → HIP), not sarğı. **`qıllar` / `qillara`** = **`qollar`** (keyboard i/o) → **`ZONE-UPPER-LIMB`**. **`göbək`** = navel → **`ZONE-ABDOMEN`**. **`əllərin içi`** = palms → **`ZONE-HAND-FOREARM`**. **`aşagi hissəsi` / `yuxari hissə`** = **`APPLICATION_SURFACE`**. Bare leftover `aşağı` is a stop (not a zone).
- **`butun`:** not a blind stop. Keyboard **t/r** → may be **`bütün`** (all) or **`burun`** (nose). Look at the SKU: `butun ayaqlar` on İnfraqırmızı = all legs; `butun beden` on Massaj 30 / UFB = full body; leftover `butun` on Trunda / İnqalyasiya = **`ZONE-FACE`**. Without a SKU, leave unmatched.
- **`bazu nahiyəsi`** = brachium (elbow–shoulder) → **`ZONE-UPPER-LIMB`**. **`canaqdan aşağı`** = below pelvis → **`ZONE-LOWER-LIMB`**. **`çanaq`** itself is hip/pelvis.
- Leftover **`ayaq` / `eyaq` / `ayalar` / `ayaqolar`** = **`ZONE-LOWER-LIMB`**. **`ayaqlar alti` / `daban altı` / `ayaqqalti`** = sole/heel → **`ZONE-FOOT-LEG`**. Hallux phrases stay longer.
- **`doş` / `dos` / `döş`** = chest (`ZONE-CHEST`). Parafin Yuxarı `döş qəfəsinə qədər ombaya olmaz` = chest + HOLD lumbar.
- **`ətraflar`** = around (stop). **`kureyine` / `kürəklərə`** = **`ZONE-BACK`**. **`3oturaq`** = sitz. **`isti olmasin`** = intensity (not hot), not a site.
- **`ayaq topuqlarina`** = ankle / malleolus (`ZONE-ANKLE`), not a new foot point.
- `burun` / `buruna` → **face** (nose), with collar if `boyun` is also written.
- 817 §15 / §18 (segmental method) share sites with §14 / §17 — method, not extra S.

`BODY_PART` rollup stays on each S for existing rotation/contraindication code.

## 4. Order fields (not S)

Shown only when the procedure type needs them. Managed lists, not free text.

| Field | WO examples | UI |
|-------|-------------|-----|
| `siteApplyMode` | `növbəli` / `novveli` / `novb` → TURN; `eyni vaxtda` / `eyni vaxda` → TOGETHER | Chips when ≥2 sites |
| Laterality | `sağ` / `sol` / `hər iki` / `hir iki` / `hər ikisinə`; **import default BOTH** when site allows laterality and text omits side | Per site that allows it |
| Amplipuls work-kind (I–V) | `4 cu rej` / `4- rej` = IV, `2 ci rej` = II | Select on Amplipuls only |
| Device program | `tenslə`, `artroz pr` / `ödem pr` / `dermo rej` / `artrit proqrqmi` / `çapıq rej` (scar) / `(b)` variant on artroz (letter B in the device menu still unnamed) | SatAdmin `PhysioListItem` DEVICE_PROGRAM — **not** I–V, not hardcoded Select |
| Electrode count | `4 lü` / `4 lu` / `4 lü rejim` = 4 plates; `2 li` = 2; `4 basliqli` / `iki basligi` | Select on Amplipuls + electrophoresis. **Planning:** `2 li` → any of **7, 8, 10–13** (12/13 as 2 of 4 paws). `4 lü` → **12 or 13** only when free. FIFO; do not hold 12/13 |
| Device params | `1 mhz`, `kəsikli`, `8/12/15 deqiqe`, UFB `0 24 başla`, Kotz `seo 550` / `deo 232`, `müalicədən öncə 1 stəkan su` | Select / number allowed by type |
| No additive | İnqalyasiya `sadə` | Flag — not a site |
| Front/back | `ön və arxa` / `aşagi hissəsi` / `yuxari hissə` on an already chosen S (or full body) | Qualifier, not extra S |
| Substance | `kalsi` (Ca), `karipazin`, `mg-le` (Mg), `mazi ile`, `bitkilərlə`, `çoban yastığı` (chamomile), `nikatin kislata` | SatAdmin `PhysioListItem` SUBSTANCE — autocomplete catalog, WO tail is open-ended |
| Extra oil | `bol yağla` / `yaqlar` | UFF / naftalan consumable note |
| Hold / stop | `dayandirilsin` / `ombaya olmaz` | Order action, not a site |
| Spine level | `l4 l5`, `c3 c4 c5` | Qualifier on spine S — **not** work-kind IV |
| Day block | `3 gün` / `5 gün` / `günaşiri` / `5 gün ardından` | Paraffin / darsonval protocol, not a zone |
| Bath day sequence | `1 ci oturaq son tam`, `1 ci dün`, `sonr4a` | Naftalan: `BATH_SEQUENCE=SITZ_THEN_FULL` (multi-day) |
| Naftalan fill | bare `tam` / `oturaq` / `qurşaq` | `NAFTALAN_FILL` closed select + chips FULL-BODY / SITZ |
| Intensity | `yungul` (light), `zəif` (weak), `isti olmasin` (not hot) | Small select |
| Smear | `surtulsun`; `siyine` = shoulder | Flag + remaining sites |

`sequenceIndex` on the order remains **program FIFO of procedure types**, not site turn-taking.

Typos (`4 lu`, `qarina`, `con tam`, `1ci son`, `kurem`, `boyunçiyin`, `bədn`) live in the **import/search alias table**. Doctors never pick those strings.

Paraffin stays **four SKUs**. Extra nahiye on the "wrong" SKU is sloppy WO data, not a fifth procedure.

## 5. Empty nahiye → default S (+ laterality)

**Import / cutover defaults (locked 2026-09):**

1. **Laterality:** if the chosen S allows laterality (`PhysioSite.laterality`) and WO did not write `sol` / `sağ` / `hər iki` → store **`BOTH`**. Midline sites stay null (no invented laterality). **Order field `LATERALITY` is omitted** on immersion baths (yod-brom, hidromasaj, naftalan ♀/♂), four-chamber, bükmə, paraffin bütün — anatomy is the chip, not L/R.
2. **Site chips when nahiye is empty:**
   - If the **procedure name already names the anatomy** → that chip (paraffin family, 4-kamera, limfo legs, turunda ear, …). **Do not** override with FULL.
   - Else if the type allowlist includes **`ZONE-FULL-BODY`** → **`ZONE-FULL-BODY`**.
   - Else if the allowlist is a **single** code → that code.
   - Else leave empty (needs doctor / unmatched). Never invent FULL when the type forbids it (ESWT, turunda-only, four-chamber-only, …).
3. Filled WO `nahiye` remains matcher SoR; defaults apply only when text is empty (or classifier returns no chips). Unmatched residue on non-empty text does **not** auto-FULL.

| Procedure | Empty site |
|-----------|------------|
| Yod-brom | Full-body chip (= heart-sparing general bath: water ≤ nipple line, head+neck out) |
| Hidromassage | Full-body chip (same immersion; jets not on heart/breast/groin) |
| Massaj 30 / 15, UFB | Full body |
| Bükmə (body wrap) | Full body (head out) |
| Limfodrenaj | Legs (default); abdomen optional addon if `qarın` / note. **Not** arms |
| `4 kamera*` | Four-chamber |
| Naftalan ♀/♂ | **Full body** when fill omitted; `oturaq` text → sitz. **Order fields:** sit/full (`NAFTALAN_FILL`), multi-day sit→full (`BATH_SEQUENCE`), **`DAY_BLOCK`** (günaşırı / 2 / 3 / 5). **No SMEAR on bath** — paid smear = `SVC-APLIKASIYA-NAFTALAN-QADIN` / `-KISI` (same gender cabins). Gender = schedule slot |
| Oturaq (text on naftalan) | Sitz chip — not a separate procedure |
| Amplipuls / electro / UFF / surface (FULL in allowlist) | Full body when nahiye empty |
| ESWT / types without FULL | No FULL invent — leave empty or single allowlist code |
| Ozone, inhalation, colon, IV | No surface site |

Code: `classifyEmptyNahiye` + `resolveEmptyImportSiteCodes` + `defaultLateralityForSite` → `applyNahiyeToProcedureOrder`.

### 5.1 Doctor picker allowlist (`ProcedureType.allowedSiteCodes`)

Seeded from `inferPhysioTypeGate` (SatAdmin may override). PATCH rejects sites outside the list.

| Family | Allowed S | Clinical note |
|--------|-----------|---------------|
| No surface | none | — |
| `4 kamera*` | `FOUR-CHAMBER` | limbs in four cells |
| Yod-brom | `FULL-BODY`, `TO-WAIST` | water ≤ nipple line; heart open; head+neck always out |
| Hidromasaj | `FULL-BODY`, `TO-WAIST` | same immersion; **jet safety hint** on form (not S chips) |
| Naftalan ♀/♂ | `FULL-BODY` + `SITZ` | two chips; gender = schedule only. Fields: `NAFTALAN_FILL`, `BATH_SEQUENCE`, `DAY_BLOCK`. No SMEAR / laterality / device params |
| Aplikasiya Naftalan ♀/♂ | anatomical surface (+ FULL) | paid smear 24 AZN; DAY_BLOCK; **shares RES-VANNA-\* with immersion bath** same gender |
| İnfraqırmızı / Sollyuks | anatomical surface | lamp + substance/extra oil (NAFTALAN); **no lamp-count field** |
| İşıq vannası | anatomical surface | light cabin after naftalan smear; **≠ İK**; no intensity from WO |
| Paraffin aşağı | legs + hip/gluteal (to buttocks) | not abdomen |
| Paraffin yuxarı | upper limb only | import prefers WO text |
| Paraffin boyun-kürək | collar / back / spine | — |
| Paraffin bütün | `FULL-BODY` | — |
| Turunda burun | FACE | split SKU (new orders) |
| Turunda qulaq | EAR | split SKU (new orders) |
| Traksiya | anatomical | traction; added FO 2026-09-04 |
| Limfodrenaj | lower limb + abdomen | doctor multi-picks; **always TOGETHER** (no TURN) |
| ESWT (zərbə) | surface without head/face/ear/**FULL** | never cranial / general |
| Amplipuls / electro / UFF | surface without EAR/SCALP | head field still allowed; fields expanded from WO reconcile 2026-09 |
| Manual / Osteopathy | surface anatomical | intensity / hold / surface; laterality on order |
| Gyn tampon / Prolotherapy | none | no surface site |
| Xallar koaqulyasiya | surface anatomical | derm local |
| Bükmə | `FULL-BODY` | wrap; head out |
| Other massage / laser / … | surface anatomical | — |

Import: filled `nahiye` text remains the matcher source of truth; allowlist only constrains the doctor picker + PATCH.

Limfo string `umusol ve sol qola nobeli` is not an arm protocol — do not map to upper limb. `umumi` on limfo is likely massage bleed; do not treat as limfo anatomy.

Massaj 15 written sites: `varatnik` / `kurek boyun` / bare `kürək` → **collar**; `ciyinlere` → **shoulder**. Paraffin `kürək bütöv` stays **back**.

## 6. Unmatched records (mandatory)

WO is free text. The matcher will never be 100%. **Unmatched is a product queue, not a bug to hide.**

### 6.1 Buckets (filled nahiye)

Source: [physio-zone-s-coverage.md](./physio-zone-s-coverage.md) · CSVs/Excel under `D:\ERA-BACKUP\NAFTA-START\clinic\reports\`.

Re-run after alias changes: `nahiye-s-coverage.cjs` then `export-nahiye-s-xlsx.cjs`. Percents in the coverage doc are the live numbers — do not freeze them here.

### 6.2 Rules

1. **Every procedure order has free-text `note`** (`ProcedureOrder.note`, already in schema). Shown on ozone, 4-chamber, Massaj 30 — not only when a site S is required. `CatalogFieldKind` `FREE_TEXT`.
2. Import: match WO `nahiye` → `sites[]` + order fields. Fresh import stores **residue** in `note` (not a duplicate of resolved S tokens). An existing doctor `note` is never wiped. Unmatched residue stays editable; doctors use the same field for comments.
3. Persist matcher output: site codes, order-field codes, **residue**, bucket (for the SatAdmin synonym queue). Ops UI shows `note`, not a second shadow box.
4. **Unknown and leftover residue** also go to a SatAdmin **synonym queue** (`/admin/physio-sites` → Unmatched). Alias an existing S; never mint a new zone from the queue.
5. Do **not** auto-create a new S from the long tail (named fingers, quadriceps/biceps, etc.) without review. `böyrəküstü` is **already** `ZONE-LUMBOSACRAL`.
6. Do **not** delete unknown rows to green a coverage %.
7. Re-run `scripts/nafta-cutover/nahiye-s-coverage.cjs` after alias changes; refresh the coverage doc.

A blank WO nahiye cell is N/A for **site chips**. The ERA `note` field is still there for the doctor.

### 6.3 Files to keep

| File | Use |
|------|-----|
| `nahiye-s-unknown.csv` | Queue: no S |
| `nahiye-s-partial.csv` | Queue: residue after S |
| `nahiye-empty-by-treatment.csv` | Empty × procedure name |
| `nahiye-freq-normalized.csv` | Full frequency (patient-aware ranking) |

## 7. UI / UX

1. **Prescribe / confirm** — site chips + autocomplete when the type needs S; extra fields from procedure type; TURN/TOGETHER if multiple sites. **`note` always** (comments + unmatched leftover).
2. **SatAdmin** — list S (retire, don’t delete); alias CRUD; unmatched queue (`CatalogField` SEARCHABLE site picker — no free-text nahiye).
3. **Filters / reports** — query by S code, regime, substance — not `LIKE` on raw nahiye.
4. **Body map** — later; not blocking chips.

## 8. Implementation waves

| Wave | Outcome |
|------|---------|
| W0 | This canon + ADR (done) |
| W1 | Lookup + aliases seed; SatAdmin CRUD for S, device programs, substances (done) |
| W2 | `sites[]` on `ProcedureOrder`; derive coarse `bodyPart`; doctor chips + always-on `note` (done) |
| W3 | Order fields + type-gated UI (done — negative path: extra field / laterality on a type that does not allow it → 400) |
| W4 | Cutover mapper + unmatched queue + raw `nahiye` (done — TS port locked to CJS via `__tests__/nahiye-match.spec.ts`; SatAdmin queue aliases existing S only) |

Do not mark Implementation-Matrix Scaffold ✅ for type-gated W3 as a standalone AC (CLI-49 stays out of BE rollup). Negative path lives in `__tests__/physio-order-fields.spec.ts` and `__tests__/nahiye-match.spec.ts`. W2–W4 have UAT-SMOKE CLI-49; Product-Readiness stays SCREEN until field UAT.

**WO field reconcile (2026-09):** dump cards → matcher flags × `inferPhysioTypeGate`. Major gap_gate closed (Amplipuls program/surface/params, electro spine/params/surface, UFF surface/program, baths `DAY_BLOCK`, 4-chamber galvano substance, SIS/ESWT day block). Residual red cells (~9) need FO judgment — often matcher bleed (İnfraqırmızı/Sollyuks «oil», Elektro `AMPLIPULS_WORK_KIND`, Karboksi laterality on no-site). Rebuild: `gen-procedure-form-matrix.ts`, `gen-procedure-order-fields-matrix.ts`, `gen-wo-fields-reconcile.ts`.

## 9. Resources (planning — not W0 schema)

Nafta electro **couches 7, 8, 10–13** (ERA will **not** have cabin 14). US / UFF: **15–16 oil, 17 gel** — separate posts, not these electro boxes.

**Four apparatuses, six couches.** One electro nurse covers all six (staff lock, not a second-electro lock on the box). Floor wiring closed 2026-08-26; BTL 4000 parallel closed with the med brother the same day.

| Unit | Model | Wiring | Parallel | 2-pad | 4-pad (`4 lü` / `4 basliqli`) |
|------|-------|--------|----------|-------|-------------------------------|
| 1 | **BTL 4000** | One unit **between 7 and 8**: E1 → 7 (2 paws), E2 → 8 (2 paws) | **Any** electro procedures on both outputs — same or different | **Yes** | **No.** Each couch has one pair. 4-pole IFC that glues E1+E2 into one therapy does not fit this split-room wiring |
| 2 | **BTL 4000** | Same **between 10 and 11** | Same | **Yes** | **No** |
| 3 | **UNISTIM 5S** | Cabin **12** only: 1 output × 4 paws | One patient | **Yes** (2 of 4 paws) | **Yes** |
| 4 | **BTL 4825S Premium** | Cabin **13** only: 1 output × 4 paws | One patient. US on this box **not used** | **Yes** (2 of 4 paws) | **Yes** |

Routing for `placeConfirmedProcedures` (order field `ELECTRODE_COUNT`, not a second `#25` SKU):

- Placement is **FIFO only**. Do **not** hold 12/13 for a later `4 lü`.
- `2 li` → any free couch in **7, 8, 10, 11, 12, 13**. On 12/13 use 2 of 4 paws — they are ordinary 2-pad resources in the queue.
- `4 lü` / `4 basliqli` / four-pole IFC → **12 or 13 only when that couch is free** (capability gate, not a priority bump).
- Cabin 7 occupied does **not** block 8 (same for 10/11). A patient in 7 cannot take both BTL 4000 outputs — the second pair is in 8.

Cutover Excel `#40` still lists 7–13 as the **LOCATION** pool for Amplipuls and Elektroforez. That matches FIFO 2-pad. Four-pad is a capability filter on the same pool, not a second SKU.

Keep **separate `ProcedureType`s** (currents + UFF gel vs oil) sharing those resources so TTK/consumables stay per procedure. UI may group them under электротерапия. Sketch in `physio-zones-s.json` → `naftaResourceSketch`.
