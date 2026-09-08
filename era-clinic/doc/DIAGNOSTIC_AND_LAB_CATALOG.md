# Diagnostic & laboratory standard catalog (ERA Clinic)

**Version:** 1.2.0 (AZ clinic + MediClub/Exonlab routine layer)  
Source of truth: [`../prisma/seed-data/diagnostic-lab-catalog.json`](../prisma/seed-data/diagnostic-lab-catalog.json)  
Seed: `prisma/seed-diagnostic-catalog*.cjs` → `Modality`/`DiagnosticService` (live SoT). `ClinicalTemplate` **dropped**. Admin: `/admin/diagnostic-catalog`. See [CLINICAL_AND_PROGRAM_TEMPLATES.md](./CLINICAL_AND_PROGRAM_TEMPLATES.md).  
P1 studies helper: `prisma/scripts/expand-diagnostic-catalog.mjs`  
Lab analyte enrichment: `prisma/scripts/enrich-lab-catalog-v12.mjs` (idempotent)

Prices stay in Finance; this catalog owns **codes + form fields / analytes / packages**.  
Clinic scope: `DiagnosticService.active` + catalog favorites (`only` hides the rest). Rare send-out: SatAdmin add, not this JSON.

**v1.2 sources:** Nafta Analyses price list; Exonlab special panels; MediClub public lab menus (biochem, general clinical, infections); Liv/Eurolab category pages. Not Referans 7000 / LOINC.

---

## Counts (v1.2)

| Layer | Count |
|-------|------:|
| Modalities | 9 |
| Study templates (imaging / functional / endoscopy) | 85 |
| Lab panels | 48 |
| Lab analytes | ~362 |
| Visit templates | 13 |
| Check-up packages | 8 |

v1.2 lab adds: Sysmex CBC extras (`MCV`…`PLT-PCT`), Nafta liver/renal/cardiac/electrolyte fields (`IBIL`, `TCO2`, `VLDL`, `LDH`/`HBDH`/`CK`, `TT3`/`TT4`), urine mucus/salts, `LAB-SMEAR`, `LAB-BIOCHEM-EXT`, `LAB-CELIAC`.

---

## Contract

| Kind | Stored as | Shape |
|------|-----------|--------|
| `imaging` / `functional` / `endoscopy` | `DiagnosticService.fieldsJson` | `{ key, type, label:{en,ru,az}, … }` |
| `lab_panel` | `DiagnosticService` + `DiagnosticAnalyte` | analytes with refs / options |
| `visit` | `DiagnosticService.fieldsJson` (`kind=visit`) | exam fields (CPOE) |
| `package` | `DiagnosticService.includesJson` | child service codes |

Shared imaging meta (`commonMetaFields`): indication, studyDate, performer, device, contrastReaction, imagesAttached.

Labels: `en` + `ru` + `az` on every title/field/analyte.

---

## 1. Imaging / instrumental (highlights + v1.1 additions)

### Ultrasound (`USG`) — 24 templates
Baseline abdomen/kidney/thyroid/breast/pelvic/obstetric/soft/prostate/doppler/MSK/hip-infant  
**+** retroperitoneal, pleura, salivary/neck, TRUS, BCA Doppler, LL veins, obst T1/T2/T3, folliculometry, liver elastography, orbit, cervical LN

Nafta cutover: `USG-ABD` is the Nafta abdomen+pelvis set (liver … ovaries + `sourceNote` for WO Qeyd), not a bare `USG` stub. Same `sourceNote` field on `USG-THYROID` / `USG-BREAST` / `USG-DOPPLER` / `USG-SOFT`. **Layers:** base `diagnostic-lab-catalog.json` + org overlay `nafta/diagnostic-overlay.json`. Seed: `node prisma/seed-diagnostic-catalog.cjs` (base then Nafta). ADR: [clinic-catalog-base-and-org-overlay-seeds.md](../../docs/adr/clinic-catalog-base-and-org-overlay-seeds.md).

### X-ray (`XR`)
Chest, spine, extremity, sinus, abdomen  
**+** fluorography, skull/sella, OPG, foot, hand

### CT / MRI
CT: head, chest, abd, spine, angio **+** sinus, TMJ, kidney multiphase, coronary CTA  
MRI: brain, spine, joint, abd **+** pituitary, breast, soft tissue, MRA, cardiac MRI  
Also: mammography, DXA

### Cardiology (`CARDIO`)
ECG-12, Holter, ABPM, EchoCG (enriched PASP/diastolic), stress ECG  
**+** stress-echo, TEE, coronary angio report

### Functional (`FUNC`)
Spirometry, EEG, EMG, audiometry, ophthalmology, dermatoscopy  
**+** spirometry+BD, PEF, tympanometry, vestibular, ENT exam, colposcopy, urea breath, evoked potentials, PSG, stabilometry

### Endoscopy (`ENDO`)
EGD, colonoscopy (+ polyps table), bronchoscopy  
**+** RRS, cystoscopy, nasal endoscopy, laryngoscopy

---

## 2. Laboratory panels (48)

| Group | Codes (examples) |
|-------|------------------|
| Core | `LAB-CBC`, `LAB-BIOCHEM`, `LAB-BIOCHEM-EXT`, `LAB-ELECTRO`, `LAB-COAG`, `LAB-GLUCOSE`, `LAB-URINE`, `LAB-SMEAR` |
| Organs | `LAB-LIVER`, `LAB-LIPID`, `LAB-RENAL`, `LAB-CARDIAC`, `LAB-INFLAM` |
| Hormones | `LAB-THYROID`, `LAB-SEX-HORM`, `LAB-ENDO-HORM`, `LAB-BHCG` |
| Infection | `LAB-INFECT`, `LAB-TORCH`, `LAB-HEP-EXT`, `LAB-INFECT-REG`, `LAB-TB-IGRA`, `LAB-RESP-PCR`, `LAB-PCR-STI` |
| Allergy | `LAB-ALLERGY`, `LAB-ALLERGY-FOOD`, `LAB-ALLERGY-INH`, `LAB-ALLERGY-PED` |
| Specialty | `LAB-RHEUMA`, `LAB-TUMOR`, `LAB-TUMOR-EXT`, `LAB-VITMIN`, `LAB-TRACE`, `LAB-IG`, `LAB-HOMOC`, `LAB-CELIAC` |
| Micro / GI / gyn | `LAB-URINE-CULT`, `LAB-MICRO-CULT`, `LAB-STOOL`, `LAB-COPROG`, `LAB-SPUTUM`, `LAB-GYN-SMEAR`, `LAB-HPV`, `LAB-CYTOLOGY`, `LAB-HISTO`, `LAB-SEMEN`, `LAB-BG`, `LAB-DRUG-SCR` |

---

## 3. Visit templates (13)

`GP-VISIT`, `CARDIO-VISIT`, `GYN-VISIT`, `PED-VISIT`, `ENT-VISIT`, `NEURO-VISIT`, `ENDO-VISIT`, `URO-VISIT`, `DERM-VISIT`, `PULM-VISIT`, `ORTHO-VISIT`, `CHECKUP-VISIT`, `SANATORIUM-INTAKE`

---

## 4. Check-up packages (8)

| Code | Includes (codes) |
|------|------------------|
| `PKG-BASIC` | CBC, biochem, urine, ECG, fluorography |
| `PKG-WOMAN` | + thyroid, pelvic/breast US, gyn smear, Pap |
| `PKG-MAN` | + lipid, abd/prostate US, ECG |
| `PKG-SENIOR` | + lipid, glucose, cardiac markers, echo, fluoro |
| `PKG-PREOP` | CBC, coag, glucose, BG, infect screen, ECG, chest XR |
| `PKG-EMPLOY` | CBC, urine, infect, fluoro, ECG, ophth, ENT |
| `PKG-SAN-ADM` | CBC, biochem, urine, ECG, fluoro, sanatorium intake |
| `PKG-NAFTA-INTAKE` | Nafta check-in checklist: `SANATORIUM-INTAKE`, `GYN-OR-URO` (→ GYN/URO by sex), `ECG-12`, `USG-ABD`. WO source = PatientDiagnostic «İlkin diaqnostik prosedurlar», **not** CheckUp `#33`. Lives in **Nafta overlay** seed, not base catalog. |

Nafta cutover: `USG-ABD` is the Nafta abdomen+pelvis set (liver … ovaries + `sourceNote` for WO Qeyd), not a bare `USG` stub. Same `sourceNote` field on `USG-THYROID` / `USG-BREAST` / `USG-DOPPLER` / `USG-SOFT`. **Layers:** base `diagnostic-lab-catalog.json` + org overlay `nafta/diagnostic-overlay.json`. Seed: `node prisma/seed-diagnostic-catalog.cjs` (base then Nafta). ADR: [clinic-catalog-base-and-org-overlay-seeds.md](../../docs/adr/clinic-catalog-base-and-org-overlay-seeds.md).
---

## 5. Explicitly deferred (P2 / tertiary)

PET/CT, nuclear medicine, full genetic NGS, newborn screening pack, IVF advanced lab, IHC pathology suites — stub later if needed; not in seed.

---

## 6. Wiring checklist

- [x] JSON catalog v1.1
- [x] Seed upserts study + lab + visit + package templates
- [x] Catalog codes in `ServiceCatalogCache` (amount 0 until Finance sync)
- [x] UI: modality/category order picker (`/lab-orders` + `DiagnosticCatalogPicker`)
- [x] UI: result form renderer (`TemplateResultForm` on `/lab-orders/[id]`)
- [x] UI: package → expand to child order codes on create
- [x] SatAdmin favorites: `/admin/diagnostic-catalog` favorites tab (`first` | `only`)
- [x] Patient card: now/next + pending labs + results/plan (`/patients/[id]` + card-summary/feed)
- [ ] Finance price-list rows per `serviceCode`

When extending: edit JSON (or re-run expand script carefully) → re-seed → keep **codes stable**.
