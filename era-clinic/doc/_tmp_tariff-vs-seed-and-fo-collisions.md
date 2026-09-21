# Spa Services Tariff ↔ seed (2026-09-04)
Source: `D:/ERA-BACKUP/NAFTA-START/1c/18-Spa-Services-Tariff.xlsx`

| Bucket | Count |
|---|---:|
| Tariff paid rows | 262 |
| With SVC code | 125 |
| Unmatched (no code) | 137 |
| Matched + in procedure-types | 19 |
| Matched + catalog only (not types) | 26 |
| Matched code missing from seed | 80 |
| procedure-types not on tariff | 25 |
| Unmatched name but found by name in seed | 0 |
| removed-zero (package/quota lines) | 66 |

## 1. procedure-types in seed but NOT on paid tariff

- `SVC-4-KAMERALI-HIDROQALVANIZASIYA` — 4 kameralı hidroqalvanizasiya (seed price 15)
- `SVC-4-KAMERALI-NAFTALAN-VANNASI` — 4 kameralı naftalan vannası (seed price 12)
- `SVC-BUKME` — Bükmə (seed price 20)
- `SVC-ELEKTROTERAPIYA` — Elektroterapiya (seed price 14)
- `SVC-HIDROKOLONOTERAPIYA-BITKI-CAYI-ILE` — Hidrokolonoterapiya (Bitki çayı ilə) (seed price 35)
- `SVC-HIDROMASAJ-VANNASI` — Hidromasaj vannası (seed price 15)
- `SVC-INFRAQIRMIZI` — İnfraqırmızı (seed price 14)
- `SVC-ISIQ-VANNASI` — İşıq vannası (seed price 10)
- `SVC-KLASIK-MASSAJ-15-DEQIQE` — Klasik massaj (15 dəqiqə) (seed price 16)
- `SVC-KLASIK-MASSAJ-30-DEQIQE` — Klasik massaj (30 dəqiqə) (seed price 19)
- `SVC-NAFTALAN-VANNASI-KISI` — Naftalan vannası (Kişi) (seed price 14)
- `SVC-NAFTALAN-VANNASI-QADIN` — Naftalan vannası (Qadın) (seed price 14)
- `SVC-PARAFINOTERAPIYA-ASAGI-ETRAF` — Parafinoterapiya (aşağı ətraf) (seed price 12)
- `SVC-PARAFINOTERAPIYA-BOYUN-KUREK` — Parafinoterapiya (boyun kürək) (seed price 14)
- `SVC-PARAFINOTERAPIYA-BUTUN-BEDEN` — Parafinoterapiya (bütün bədən) (seed price 18)
- `SVC-PARAFINOTERAPIYA-YUXARI-ETRAF` — Parafinoterapiya (yuxarı ətraf) (seed price 11)
- `SVC-PROLOTERAPIYA` — Proloterapiya (seed price 40)
- `SVC-QISA-DALGA-TERAPIYA-UVC` — Qısa dalğa terapiya UVÇ (seed price 12)
- `SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI` — Super Inductive system terapiyası (seed price 30)
- `SVC-TURUNDA-BURUN-VE-QULAQ` — Turunda (burun və qulaq) (seed price 12)
- `SVC-ULTRAFONOFOREZ-GEL` — Ultrafonoforez (Gellə) (seed price 12)
- `SVC-UROLOJI-MIKROKLIZMA` — Uroloji mikroklizma (seed price 14)
- `SVC-XALLARIN-KOAQULYASIYASI` — Xalların koaqulyasiyası (seed price 20)
- `SVC-YOD-BROM-VANNASI` — Yod brom vannası (seed price 18)
- `SVC-ZERBE-DALGA-TERAPIYA` — Zərbə dalğa terapiya (seed price 24)

## 2. Tariff matched codes that are catalog-only (not in procedure-types)

- `SVC-BIOREVITALIZASIYA` — tariff «Biorevitalizasiya» / catalog «Biorevitalizasiya» (Косметолог, 160)
- `SVC-DOLGU-1QR` — tariff «Dolğu 1 QR» / catalog «Dolğu 1qr» (Косметолог, 220)
- `SVC-ELEKTROFOREZ` — tariff «Elektroforez» / catalog «Elektroforez» (Пакет услуг, null)
- `SVC-FULL-BOTOKS-1-PROSEDURU` — tariff «Full Botoks 1 Prosedur» / catalog «Full botoks 1 proseduru» (Косметолог, 200)
- `SVC-GINEKOLOQ` — tariff «Ginekoloq» / catalog «Ginekoloq» (Прием врача, 20)
- `SVC-KINEZIOTERAPIYA` — tariff «Kinezioterapiya» / catalog «Kinezioterapiya» (Мануальная терапия, 35)
- `SVC-METABOLIK-INFUZIYA` — tariff «Metabolik infuziya» / catalog «Metabolik infuziya» (Поликлиника, 75)
- `SVC-MEZOTERAPIYA-SAC` — tariff «Mezoterapiya (Saç)» / catalog «Mezoterapiya (saç)» (Косметолог, 75)
- `SVC-MEZOTERAPIYA-UZ` — tariff «Mezoterapiya (Üz)» / catalog «Mezoterapiya (üz)» (Косметолог, 75)
- `SVC-MIOFASSIAL-TERAPIYA` — tariff «Miofassial terapiya» / catalog «Miofassial terapiya» (Мануальная терапия, 50)
- `SVC-PARAFIN` — tariff «Parafin tüm bədən» / catalog «Parafin» (Пакет услуг, null)
- `SVC-PILINQ-UZ` — tariff «Pilinq (Üz)» / catalog «Pilinq (üz)» (Косметолог, 70)
- `SVC-PRP-TERAPIYA` — tariff «PRP prosedur» / catalog «PRP terapiya» (Косметолог, 50)
- `SVC-QUA-SA-TERAPIYA` — tariff «Qua-Şa» / catalog «QUA-SA terapiya» (Мануальная терапия, 40)
- `SVC-SIDIYIN-UMUMI-ANALIZI` — tariff «Sidiyin ümumi analizi» / catalog «Sidiyin ümumi analizi» (Пакет услуг, null)
- `SVC-SOLYUKS` — tariff «İnfraqırımı -Solyuks» / catalog «Solyuks» (Пакет услуг, null)
- `SVC-TERAPEVT` — tariff «Fizioterapevt qəbulu2» / catalog «Terapevt» (Прием врача, 20)
- `SVC-UROLOQ` — tariff «Урологический микроклизма» / catalog «Uroloq» (Прием врача, 20)
- `SVC-VENADAXILI-INYEKSIYA` — tariff «Venadaxili inyeksiya» / catalog «Venadaxili inyeksiya» (Поликлиника, 3)
- `SVC-VISSERAL-TERAPIYA` — tariff «Visseral terapiya» / catalog «Visseral terapiya» (Мануальная терапия, 50)

## 3. Tariff UNMATCHED (no code) — top by group

### Ödənişli Prosedurlar (35)
- Aplikasiya Naftalan (24)
- Bio masaj (30 deq) (30)
- Bio ultura üz masaj 20 dəq (25)
- Boğaz Aplikasiya (8)
- Böyrəklər (15)
- Follikulometriya ilk dəfə (20)
- Ginekoloji masaj (14)
- Ginekoloji USM (25)
- Hidromassaj bitki ekstraktları ilə (25)
- Hİdromassaj bitki ekstraktları ilə (35)
- Hidromassaj sadə (20)
- Hidromassaj sadə (30)
- İqloterapiya (25)
- İmalə çaylar ilə (10)
- Kvars (14)
- Qalvanizasiya vannası bütün ətraflar (30)
- Qara ciyər öd kisəsi (15)
- Laennec (89)
- Limfa düyünləri (12)
- LOD (14)
- Mikrokilizma (14)
- Müalicəvi nöqtə (30)
- Plazmaterapiya derialti (15)
- Pnevmapunktura (19)
- Sistem (venadxili inyeksiya) (15)
- Termo yorğan (30)
- Termo yorğan (20)
- Traksiya (quru) (20)
- Triqqerzonalar ilə işləmə (50)
- Turunda qulaq (12)
- Ultrafanofarez (12)
- Uroloji masaj (prostat) (14)
- Uroloji-böyrəklər-prostat vəzi (20)
- UVC terapiya (8)
- Üst abdomen (20)

### Naftalan Məhsulları (29)
- Ağrı kəsici krem 175qr (22)
- Anti-Age üz kremi 30ml (32)
- B-trisol (35)
- Balzam 200ml (25)
- Əl və üz kremi 175qr (22)
- Karpazim1,Eyfulin2,Natrixlor3 (14)
- Maqnezium B6 vitamini (35)
- Maska 200ml (25)
- Naft Plast (ədəd) (1.5)
- Naft Plast (packa) (30)
- Naftalan ağ 0.5ml (36)
- Naftalan ağ 100ml (12)
- Naftalan ağ 330ml (24)
- Naftalan ağ yağ 1 litr (60)
- Naftalan kremi 25 qr (2)
- Naftalan sarı 0.5ml (21)
- Naftalan sarı 1lt (38)
- Naftalan sarı 330ml (18)
- Naftalan sari yağı AZ NAFTA. OİL (9)
- Naftalan yağı 1lt (95)
- Sabun 120qr (8)
- Sabun-krem 129qr (16)
- Saç kremi 250ml (34)
- Savis (6)
- Skrab 250 ml (23)
- Şampun ağ 150ml (8)
- Şampun qara 150ml (8)
- Vazelin kremi (4)
- Vibro-lazer uroloji (12)

### Laboratuar Müayinə (22)
- Alanin aminotransferaz (ALT)( SGPT)(Kurort) (4.5)
- Anti HBs(cart test)(Kurort) (7.2)
- Anti HCV(cart test)( Kurort) (7.2)
- Aspartat aminotransferaz (AST)(SGOT)(Kurort) (4.5)
- Bilirubin (total) (12)
- Ferritin (25)
- Glukoza təyini (Glukometrlə) (5)
- HDL Chol (14)
- HDL(Kurort) (7.2)
- Hemoqram(ən az 18 parametr) (Kurort) (7.2)
- Qan testi (5)
- Qanda şəkər (10)
- Qanın ümumi analizi (18 parametr+EÇS) (12)
- Qanın ümumi analizi 19 parametr (10)
- Qlükoza ( aclıq) qan( Kurort) (4.5)
- LDL Chol (14)
- LDL(Kurort) (7.2)
- Sidik ümumi təhlili(strip və mikroskop)(Kurort) (7.2)
- Syphiliis (10)
- Trigliserid(Kurort) (7.2)
- UricAsid (UA) (10)
- VLDL Chol (14)

### USM (19)
- Aşağı Ətraf Doppleri (A/V) – 1 ətraf (40)
- Aşağı Ətraf Doppleri (A/V) – 2 ətraf (80)
- Aşağı Ətraf Doppleri (V) – 1 ətraf (25)
- Aşağı Ətraf Doppleri (V) – 2 ətraf (50)
- Dərialtı USM (20)
- Pelvik USM (20)
- Skrotal Doppler USM (50)
- Skrotal USM (35)
- Tam Abdomen USM (45)
- Uroloji USM (25)
- USM bud canaq oynağı nahiyəsi (20)
- USM dopler 1 ətraf (25)
- USM Dopler 2 ətraf- (35)
- USM Hamiləlik böyük müddət (25)
- USM Hamiləlik kiçik müddət (15)
- USM Süd vəziləri (30)
- USM tam qarın (ümumi abdominal) (25)
- USM Tiroid (25)
- Üst Abdomen USM (25)

### HICAMA (12)
- Hicama 1 Banka (8)
- Hicama 10 Banka (45)
- Hicama 2 Banka (9)
- Hicama 3 Banka (13.5)
- Hicama 4 Banka (18)
- Hicama 5 Banka (22.5)
- Hicama 6 Banka (27)
- Hicama 7 Banka (31.5)
- Hicama 8 Banka (36)
- Hicama 9 Banka (40.5)
- Hicama( böyük nahiyyə) (40)
- Hicama(kicik nahiyyə) (25)

### SPA (8)
- Alqoloji (50)
- Kisə (15)
- Kisə Köpük (10)
- Köpük masaj (15)
- Proloterapiya1 (20)
- Proloterapiya2 (30)
- PRP1 (20)
- PRP2 (30)

### Əlavə Həkim qəbulu (4)
- EXO K,Q (30)
- EQK Çəkilməsi (10)
- Kardioloqun Konsultasıyası (15)
- Nevroloqun Konsultasıyası (15)

### Spa masaj (relax) (4)
- Masaj (relax) 20 dəq (25)
- Masaj (relax) 30 dəq (30)
- Masaj (relax) 45 dəq (44)
- Masaj (relax) 60 dəq (55)

### Əlavə (3)
- Əzələ iynəsi (2)
- V/D sistem ( kokteyl ) (20)
- V/D sistem (hər şey qonaqdan) (5)

### Naftalan Müayinə Programı (1)
- EKG (10)

## 4. removed-zero highlights (package lines, not SKUs)

- Amplipuls (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Elektroforez (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Naftalan Vannası (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Parafin (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Solyuks (1 lampa) Naftalanla (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Solyuks (6 lampa) Naftalanla (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- Ultrafonoforez (təmizlənmiş naftalan ilə) (0) — DROP_ZERO_NOT_A_SKU / Naftalan Müalicə Programı
- 4 KAMERALI NAFTALAN VANNASI (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- Aplikasiya Naftalanla (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- ELEKTROFAREZ (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- KLASSİK MASSAJ (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- KLASSİK MASSAJ (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- NAFTALAN VANNASI (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- SOLYUKS (0) — DROP_ZERO_NOT_A_SKU / Ödənişsiz Prosedurlar
- Aplikasiya Naftalan (0) — DROP_ZERO_NOT_A_SKU / SPA

## 5. FO morning — İnfraqırmızı / Sollyuks + naftalan oil

Evidence: WO free-text on lamp SKUs almost always says **naft. / naftalanla / bol yağla**. Tariff removed-zero already has **«Solyuks (1 lampa) Naftalanla»** as a package component (price 0). So this is likely **real Nafta practice** (IR/Sollyuks with naftalan smear), not import noise.

Ask med block:
1. Is İnfraqırmızı routinely prescribed **with naftalan oil** on the skin?
2. Same for Sollyuks (especially scalp / baş)?
3. If yes: one field on the lamp order (substance=NAFTALAN / extra oil), or a **separate package SKU**?

### Unique WO texts (from dump)
Generated from D:/ERA-BACKUP/NAFTA-START/clinic/dump/cards. Total rows: 137.

## İnfraqırmızı (100)

- **×14** [SUBSTANCE_OR_ADDITIVE] `Nftal. butov kurek`
- **×12** [EXTRA_OIL] `kurek ayaqlar naftalanan novbəli`
- **×12** [SUBSTANCE_OR_ADDITIVE] `Kurek ayaqlar novbeli naft.`
- **×12** [SUBSTANCE_OR_ADDITIVE] `Kurek bel oma ayaqlar naft.`
- **×12** [SUBSTANCE_OR_ADDITIVE] `Sargi nahiyyesi budhissesi Ayaqlari naft.`
- **×10** [SUBSTANCE_OR_ADDITIVE] `bedenin on ve arxa hissesi naft.`
- **×10** [EXTRA_OIL] `Naftalanla ayaqlar`
- **×9** [SUBSTANCE_OR_ADDITIVE] `Bud canaq bud ayaqlar naft`
- **×6** [SUBSTANCE_OR_ADDITIVE] `Bedenin on ve arxa hissesi qollar naft. novbeli`
- **×3** [SUBSTANCE_OR_ADDITIVE] `Naft. bel kurek on ve arxa 5dq`

## Sollyuks (37)

- **×12** [EXTRA_OIL] `başına bol yağla`
- **×10** [SUBSTANCE_OR_ADDITIVE] `naft. basin tuklu hissesi`
- **×9** [SUBSTANCE_OR_ADDITIVE] `Basin tuklu hissesi naft`
- **×6** [EXTRA_OIL] `başa temiz naftalanla`
