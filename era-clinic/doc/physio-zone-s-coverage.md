# WO nahiye → S coverage

**Canon:** [physio-site-canon.md](./physio-site-canon.md) §6 unmatched.
Matcher adapter: `scripts/nafta-cutover/nahiye-s-match.cjs` (driven by `physio-zones-s.json`). Report: `nahiye-s-coverage.cjs`.

Unmatched is **in scope**. Excel (A→Z): `D:/ERA-BACKUP/NAFTA-START/clinic/reports/nahiye-s-unknown.xlsx`, `nahiye-s-partial.xlsx`, `nahiye-s-empty.xlsx` (Needs site vs N/A). Re-export: `scripts/nafta-cutover/export-nahiye-s-xlsx.cjs`.

Closed: quadriseps → thigh (HIP-GLUTEAL), not a new S; laser `* pr`/`* rej` = DEVICE_PROGRAM not PRP; turunda/tampon = procedure; furun = nose; raloji rej on electrophoresis = nevraloji not radiology; neloma/meloma = beloma (keyboard), not melanoma; çoban yastığı = chamomile; qoltuqaltı → upper limb; dumbek/sakrum = sacrum → LUMBOSACRAL; sagri = haunch HIP not bandage; sargi/sagir/venalara unmatched; qıllar = qollar (keyboard i/o) → UPPER-LIMB; göbək → ABDOMEN; çapıq rej = scar program; fonofarez = Ultrafonoforez bleed. leftover butun: bütün if another site or Massaj/UFB SKU; burun (FACE) on Trunda/İnqalyasiya. oma → LUMBOSACRAL; topuqlarina / malleol = ankle. dizdən aşağı → FOOT-LEG; dizaltı → KNEE; baldır ≠ bud. erector spina → SPINE-FULL; supraspinatus → SHOULDER; thorakal → CHEST; ekstremite = limbs. kürəkalti → BACK; leftover ayaq → LOWER-LIMB; doş → CHEST; bazu → UPPER-LIMB; qollardan aşağı → HAND-FOREARM on upper paraffin; 4 lü / 4 lü rejim = 4 pads not work-kind IV.

## Answers (empty / substance / ayaqlar / face / növbəli)

- **Empty + procedure name (reception 2026-08-25):** yod-brom / hidromasaj / Massaj 30 / UFB / Bükmə → `ZONE-FULL-BODY`. Limfodrenaj empty → legs; `qarın` adds abdomen. `4 kamera*` → four-chamber. Massaj 15 still needs a region. Naftalan fill stays doctor (tam|oturaq|qurşaq). Ozone / inhalation / colon empty is honest (no surface site).
- **Substance-only (`bitkilərlə` / `nikatinle`):** almost all sit on İnqalyasiya and 4-kamera — site is the procedure, nahiye is the additive. Not a missing zone.
- **`ayaqlar`:** on Parafin Aşağı / limfodrenaj / maqnit this is `ZONE-LOWER-LIMB`, not heels. Heels are `daban`; ankle is `topuq` (`ZONE-FOOT-LEG` / `ZONE-ANKLE`).
- **Face and heels:** codes exist (`ZONE-FACE`, `ZONE-FOOT-LEG` daban, `ZONE-ANKLE` topuq). Long-tail was missing **aliases**, not codes.
- **boyun:** reception = collar (trapezius / scalenus) → `ZONE-COLLAR`. `ZONE-NECK` remains 817 §3 without a WO alias.
- **növbəli:** one `ProcedureOrder`, `sites[]` in order, `siteApplyMode=TURN` (same slot). `sequenceIndex` stays program FIFO. `1 ci oturaq son tam` is `BATH_SEQUENCE` (different days). `eyni vaxtda` = TOGETHER.

Dump cards: filled nahiye 52581; blank cell 13686 (N/A vs needs-site split below). Freq CSV: **52581** rows / **2341** unique.

## Filled strings (52581 rows / 2341 unique)

| Bucket | Unique | Rows | % rows | Σ patients (over-count) |
|--------|-------:|-----:|-------:|------------------------:|
| mapped | 2202 | 51157 | 97.3% | 6246 |
| flags-only | 36 | 732 | 1.4% | 168 |
| partial | 88 | 606 | 1.2% | 88 |
| unknown | 15 | 86 | 0.2% | 15 |

Patient column is **sum of per-string unique patients** (a patient in two strings is counted twice). Use for ranking, not headcount.

### Top unknown

| rows | patients | text | residue | doctor |
|-----:|---------:|------|---------|--------|
| 12 | 1 | bedennin on və arxa (5deq-5deyqa) | bedennin 5deyqa | Rəna Kəngərli (12) |
| 10 | 1 | pb sulfat + anot/ eufillin - hissesine | pb sulfat anot | Rafiq Hüseynov (10) |
| 9 | 1 | tens proqrami akut eneljisizik proqrami 4 basliqli | akut eneljisizik | Rafiq Hüseynov (9) |
| 8 | 1 | trapesiyayabənzər əzələ di zətrafi kali yodla osteoparoz pr ilə növbəli | trapesiyayabenzer di zetrafi osteoparoz | Azadə Mustafayeva (8) |
| 7 | 1 | tzm | tzm | Azadə Mustafayeva (7) |
| 6 | 1 | kronik aneljizik proqrami | kronik aneljizik | Rafiq Hüseynov (6) |
| 6 | 1 | tens xronik aneljisizk proqrami | xronik aneljisizk | Rafiq Hüseynov (6) |
| 6 | 1 | tens proqrami kronik | kronik | Rafiq Hüseynov (6) |
| 6 | 1 | varikoz programi ilə | varikoz programi | Rəna Kəngərli (6) |
| 5 | 1 | enterferensial proqramla 90-100 hz | 90 100 hz | Rafiq Hüseynov (5) |
| 5 | 1 | tonzillarin üzərinə | tonzillarin uzerine | Azadə Mustafayeva (5) |
| 3 | 1 | tan | tan | Rafiq Hüseynov (3) |
| 1 | 1 | 1 günlük ginekoloq baxişindan sonra deyis | 1 gunluk ginekoloq baxisindan sonra deyis | Rafiq Hüseynov (1) |
| 1 | 1 | diadinamik 1df tezlik 100 hz 3 dəqiqə 2 mf tezlik 50 hz 3 lp 6 diqiqə | diadinamik 1df tezlik 100 hz 2 mf tezlik 50 hz 3 lp 6 diqiqe | Rafiq Hüseynov (1) |
| 1 | 1 | us m regio lumbalis-m erector spinae m multifidus | us m regio lumbalis m erector spinae m multifidus | Rafiq Hüseynov (1) |

### Top partial

| rows | patients | text | chips | residue | doctor |
|-----:|---------:|------|-------|---------|--------|
| 12 | 1 | her iki ciyinlereve dizlere nobeli | ZONE-KNEE | ciyinlereve | Kəmaləddin Şahmuradov (12) |
| 12 | 1 | növbəli əllərə boyun çiyin osteoartroz pr ilə | ZONE-COLLAR|ZONE-HAND-FOREARM | osteoartroz | Azadə Mustafayeva (12) |
| 12 | 1 | sargi nahiyyesi budhissesi ayaqlari naft | ZONE-HIP-GLUTEAL|ZONE-LOWER-LIMB | sargi | Azadə Mustafayeva (12) |
| 12 | 1 | trapesiyayabənzər əzələ bel oma növbəli dimeksidlə | ZONE-LUMBOSACRAL | trapesiyayabenzer dimeksidle | Azadə Mustafayeva (12) |
| 11 | 1 | tens proqrami boyun nahiyesine akut aneljizik proqrami | ZONE-COLLAR | akut aneljizik | Rafiq Hüseynov (11) |
| 10 | 1 | boyun çiyin l1 l2kali yodla növbəli | ZONE-COLLAR | l2kali yodla | Azadə Mustafayeva (10) |
| 10 | 1 | el bilekleri revmatoid artrit proqrami ile | ZONE-HAND-FOREARM | bilekleri revmatoid | Rafiq Hüseynov (10) |
| 10 | 1 | eyaqlar trofik xora | ZONE-LOWER-LIMB | trofik xora | Rafiq Hüseynov (10) |
| 10 | 1 | kaliyod 4 basliqli eyni anda 2 si sol ciyin ciyine 2 si sag budaq | ZONE-SHOULDER | 2 si 2 si budaq | Rafiq Hüseynov (10) |
| 10 | 1 | onurga boyu dizlər artoz pr ilə | ZONE-SPINE-FULL|ZONE-KNEE | artoz | Azadə Mustafayeva (10) |
| 10 | 1 | tens proqrami ile lumbar nahiyesi akut aneljizisk | ZONE-LUMBOSACRAL | akut aneljizisk | Rafiq Hüseynov (10) |
| 10 | 1 | trapez ezeleler enterferensial proqrami ile 90-100 hz | ZONE-COLLAR | 90 100 hz | Rafiq Hüseynov (10) |
| 10 | 1 | umusol ve sol qola nobeli | ZONE-UPPER-LIMB | umusol | Kəmaləddin Şahmuradov (10) |
| 9 | 1 | 1 mhz tam onurğa erecto spina və trapezin spina ezeler | ZONE-SPINE-FULL | erecto spina trapezin spina ezeler | Rafiq Hüseynov (9) |
| 9 | 1 | 5 gün baş boyun və 5 günyaqlar | ZONE-COLLAR|ZONE-HEAD | 5 gunyaqlar | Rafiq Hüseynov (9) |
| 9 | 1 | beloma nahiyesine4 cu rej | ZONE-LUMBOSACRAL | nahiyesine4 cu | Azadə Mustafayeva (9) |
| 9 | 1 | boyun çiyibn əllər dizlər növbəli | ZONE-KNEE|ZONE-COLLAR|ZONE-HAND-FOREARM | ciyibn | Azadə Mustafayeva (9) |
| 9 | 1 | ellere artroz rejdizlər topuq növbəli | ZONE-HAND-FOREARM|ZONE-ANKLE | rejdizler | Azadə Mustafayeva (9) |
| 9 | 1 | enterferensial proqrami ile 90-100 frekans 4 basliqli quadrapolar trapez ezelelerine | ZONE-COLLAR | quadrapolar | Rafiq Hüseynov (9) |
| 9 | 1 | her iki dizin 4-6 jl artrozun proqrami ile | ZONE-KNEE | 4 6 jl artrozun | Rafiq Hüseynov (9) |

## Blank WO nahiye field

WO always has the cell. **13686** blanks, of which **10943** do not need a body site (N/A) and **2743** still do.

N/A is **not** unmatched S. Ozone / inhalation / colon / IV have no surface site. Massaj 30 / UFB / 4-kamera / yod-brom already name the site in the SKU — import defaults from the procedure, doctors do not fill nahiye.

| role | rows | treatments | kinds |
|------|-----:|-----------:|-------|
| N/A (field not used) | 10943 | 18 | no-surface-site, site-in-name, site-in-name-missing-nose |
| still needs a site | 2743 | 66 | needs-nahiye, fill-ambiguous (naftalan tam/oturaq) |

### N/A — not a catalog gap

| rows | patients | kind | default S | treatment |
|-----:|---------:|------|-----------|-----------|
| 3712 | 704 | no-surface-site | — | Ozonterapiya |
| 1777 | 452 | site-in-name | ZONE-FULL-BODY | Massaj 30 |
| 953 | 171 | site-in-name | ZONE-FOUR-CHAMBER | 4 kamera vanna |
| 875 | 135 | site-in-name | ZONE-FULL-BODY | UFB terapiya |
| 751 | 114 | site-in-name | ZONE-FULL-BODY | Bükmə |
| 616 | 153 | site-in-name | ZONE-FOUR-CHAMBER | 4 kamera hidroqalvanizasiya |
| 467 | 214 | site-in-name | ZONE-FULL-BODY | Yod-brom vanna |
| 350 | 90 | site-in-name | ZONE-LOWER-LIMB | Limfodrenaj |
| 314 | 77 | no-surface-site | — | İnqalyasiya |
| 283 | 48 | site-in-name-missing-nose | — | Trunda burun |
| 222 | 129 | no-surface-site | — | Hidrokоlon ( bitki çayı ilə) |
| 220 | 97 | site-in-name | ZONE-FULL-BODY | Hidromasaj vanna |
| 163 | 41 | site-in-name | ZONE-FULL-BODY | Massaj 30 (test) |
| 74 | 17 | no-surface-site | — | Uroloji vibro lazer |
| 57 | 14 | site-in-name | ZONE-EAR | Turunda qulaq |
| 56 | 30 | no-surface-site | — | Hidrokolon |
| 30 | 12 | site-in-name | ZONE-UPPER-LIMB | Parafin Yuxarı nahiyə |
| 23 | 5 | site-in-name | ZONE-COLLAR | Parafin Kürək - onurğa |

### Still needs a site

| rows | patients | kind | default S | treatment |
|-----:|---------:|------|-----------|-----------|
| 330 | 98 | needs-nahiye | — | Massaj 15 |
| 288 | 97 | needs-nahiye | — | Karbon vannası 15 dəq |
| 230 | 45 | needs-nahiye | — | - (Köhnə) |
| 160 | 64 | needs-nahiye | — | Manual Terapiya |
| 133 | 32 | needs-nahiye | — | Venadaxili inyeksiyalar |
| 131 | 49 | fill-ambiguous | — | Naftalan vannası (Kişi) |
| 110 | 20 | needs-nahiye | — | Mikroklizma |
| 109 | 29 | needs-nahiye | — | Karboksiterapiya |
| 103 | 35 | needs-nahiye | — | Sistem ( venadaxili infuziiya ) (QONAQ) |
| 99 | 24 | fill-ambiguous | — | Naftalan vannası (Qadın) |
| 94 | 58 | needs-nahiye | — | Baş həkimin qəbulu |
| 94 | 33 | needs-nahiye | — | EKQ və kardioloqun müayinəsi |
| 88 | 18 | needs-nahiye | — | Laennec |
| 73 | 33 | needs-nahiye | — | Super induktiv terapiya |
| 67 | 15 | needs-nahiye | — | Əzələ iynəsi |
| 60 | 13 | needs-nahiye | — | - (Köhnə 1) |
| 52 | 23 | needs-nahiye | — | Amplipuls |
| 45 | 15 | needs-nahiye | — | Ginekoloji tampon |
| 39 | 32 | needs-nahiye | — | Ultrafonoforez (Naftalan yağıyla) |
| 31 | 19 | needs-nahiye | — | Zərbə dalğa |
| 31 | 9 | needs-nahiye | — | İnfraqırmızı |
| 28 | 14 | needs-nahiye | — | Osteopatiya |
| 25 | 12 | needs-nahiye | — | Darsonval |
| 25 | 12 | needs-nahiye | — | Lazerterapiya |
| 25 | 12 | needs-nahiye | — | Fitoterapiya ( boçka ) |

## Substance-only nahiye (`bitkilərlə` / `nikatinle`)

| rows | patients | treatment |
|-----:|---------:|-----------|
| 268 | 62 | İnqalyasiya |
| 164 | 40 | 4 kamera hidroqalvanizasiya |
| 30 | 20 | Hidrokоlon ( bitki çayı ilə) |

## `ayaqlar` / `asagi etraflara` × treatment (coarse vs foot)

| rows | patients | treatment |
|-----:|---------:|-----------|
| 1815 | 227 | Maqnitoterapiya |
| 1779 | 198 | Ultrafonoforez (Naftalan yağıyla) |
| 1344 | 161 | İnfraqırmızı |
| 1263 | 164 | Parafin Yuxarı nahiyə |
| 1137 | 152 | Parafin Aşağı nahiyə |
| 778 | 105 | Ultrafonoforez (Gellə) |
| 768 | 107 | Darsonval |
| 767 | 173 | Limfodrenaj |
| 478 | 61 | Parafin Kürək - onurğa |
| 274 | 39 | Mıg (Köhnə) |
| 180 | 22 | Lazerterapiya |
| 81 | 10 | Solyuks |
| 54 | 7 | Amplipuls |
| 36 | 7 | Massaj 15 |
| 35 | 5 | Naftalan vannası (Kişi) |
| 25 | 4 | İşıq vannası |
| 25 | 2 | Parafin bütün bədən |
| 24 | 4 | 4 kamera vanna |
| 20 | 3 | Naftalan vannası (Qadın) |
| 11 | 1 | Elektroforez |

Paraffin **Aşağı** + `ayaqlar` → keep `ZONE-LOWER-LIMB` (name already says lower limb). Darsonval/Solux + `ayaqlar` → same, not heels (`daban` / `topuq` are separate S).
