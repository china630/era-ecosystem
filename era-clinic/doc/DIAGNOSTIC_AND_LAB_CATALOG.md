# Diagnostic & laboratory standard catalog (ERA Clinic)

**Version:** 1.1.0 (P0+P1 outpatient / sanatorium / check-up)  
Source of truth: [`../prisma/seed-data/diagnostic-lab-catalog.json`](../prisma/seed-data/diagnostic-lab-catalog.json)  
Seed: `prisma/seed-vnext.ts` → `ClinicalTemplate` + `ServiceCatalogCache`  
Expand helper: `prisma/scripts/expand-diagnostic-catalog.mjs` (idempotent re-apply)

Prices stay in Finance; this catalog owns **codes + form fields / analytes / packages**.

---

## Counts (v1.1)

| Layer | Count |
|-------|------:|
| Modalities | 9 |
| Study templates (imaging / functional / endoscopy) | 85 |
| Lab panels | 45 |
| Lab analytes | ~265 |
| Visit templates | 13 |
| Check-up packages | 7 |

---

## Contract

| Kind | Stored as | `bodyJson` |
|------|-----------|------------|
| `imaging` / `functional` / `endoscopy` | `ClinicalTemplate` | `{ kind, modality, category, title, metaFields, fields }` |
| `lab_panel` | `ClinicalTemplate` + catalog code | `{ kind, category, title, analytes }` |
| `visit` | `ClinicalTemplate` | `{ kind, specialty, title, fields }` |
| `package` | `ClinicalTemplate` + catalog code | `{ kind, title, includes[] }` |

Shared imaging meta (`commonMetaFields`): indication, studyDate, performer, device, contrastReaction, imagesAttached.

Labels: `en` + `ru` + `az` on every title/field/analyte.

---

## 1. Imaging / instrumental (highlights + v1.1 additions)

### Ultrasound (`USG`) — 24 templates
Baseline abdomen/kidney/thyroid/breast/pelvic/obstetric/soft/prostate/doppler/MSK/hip-infant  
**+** retroperitoneal, pleura, salivary/neck, TRUS, BCA Doppler, LL veins, obst T1/T2/T3, folliculometry, liver elastography, orbit, cervical LN

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

## 2. Laboratory panels (45)

| Group | Codes (examples) |
|-------|------------------|
| Core | `LAB-CBC`, `LAB-BIOCHEM`, `LAB-ELECTRO`, `LAB-COAG`, `LAB-GLUCOSE`, `LAB-URINE` |
| Organs | `LAB-LIVER`, `LAB-LIPID`, `LAB-RENAL`, `LAB-CARDIAC`, `LAB-INFLAM` |
| Hormones | `LAB-THYROID`, `LAB-SEX-HORM`, `LAB-ENDO-HORM`, `LAB-BHCG` |
| Infection | `LAB-INFECT`, `LAB-TORCH`, `LAB-HEP-EXT`, `LAB-INFECT-REG`, `LAB-TB-IGRA`, `LAB-RESP-PCR`, `LAB-PCR-STI` |
| Allergy | `LAB-ALLERGY`, `LAB-ALLERGY-FOOD`, `LAB-ALLERGY-INH`, `LAB-ALLERGY-PED` |
| Specialty | `LAB-RHEUMA`, `LAB-TUMOR`, `LAB-TUMOR-EXT`, `LAB-VITMIN`, `LAB-TRACE`, `LAB-IG`, `LAB-HOMOC` |
| Micro / GI / gyn | `LAB-URINE-CULT`, `LAB-MICRO-CULT`, `LAB-STOOL`, `LAB-COPROG`, `LAB-SPUTUM`, `LAB-GYN-SMEAR`, `LAB-HPV`, `LAB-CYTOLOGY`, `LAB-HISTO`, `LAB-SEMEN`, `LAB-BG`, `LAB-DRUG-SCR` |

---

## 3. Visit templates (13)

`GP-VISIT`, `CARDIO-VISIT`, `GYN-VISIT`, `PED-VISIT`, `ENT-VISIT`, `NEURO-VISIT`, `ENDO-VISIT`, `URO-VISIT`, `DERM-VISIT`, `PULM-VISIT`, `ORTHO-VISIT`, `CHECKUP-VISIT`, `SANATORIUM-INTAKE`

---

## 4. Check-up packages (7)

| Code | Includes (codes) |
|------|------------------|
| `PKG-BASIC` | CBC, biochem, urine, ECG, fluorography |
| `PKG-WOMAN` | + thyroid, pelvic/breast US, gyn smear, Pap |
| `PKG-MAN` | + lipid, abd/prostate US, ECG |
| `PKG-SENIOR` | + lipid, glucose, cardiac markers, echo, fluoro |
| `PKG-PREOP` | CBC, coag, glucose, BG, infect screen, ECG, chest XR |
| `PKG-EMPLOY` | CBC, urine, infect, fluoro, ECG, ophth, ENT |
| `PKG-SAN-ADM` | CBC, biochem, urine, ECG, fluoro, sanatorium intake |

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
