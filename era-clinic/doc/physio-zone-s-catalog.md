# Physio / sanatorium site catalog (S) — zone table

**Canon (wins on conflict):** [physio-site-canon.md](./physio-site-canon.md) · **ADR:** [clinic-physio-site-catalog.md](../../docs/adr/clinic-physio-site-catalog.md)

**Status:** W1 seed loaded into `physio_site` (SatAdmin). This file remains the human table; JSON is seed input, not runtime SoR.

Doctor picks **S**. **A** (FMA/TA) is pre-bound. Sock/glove are **aliases of foot/hand**, not a separate cut field. `növbəli` / Amplipuls I–V / `4 lü` plates / MHz are order fields.

Sources: Minzdrav USSR **817/1987**; **Shcherbak** collar+panty; hydro fill. 817 is repealed in RF (2023) but still the CIS spa vocabulary.

Counts: **31** S codes. 817 §15 and §18 share sites with §14 and §17 — not extra codes.

Data: `prisma/seed-data/nafta/physio-zones-s.json` (seed only). Unmatched WO: [physio-zone-s-coverage.md](./physio-zone-s-coverage.md).

## Closed catalog rules

- **PELOID-CLOTHING-CUT:** Gloves/socks alias ZONE-HAND-FOREARM / ZONE-FOOT-LEG. Not extra S codes. Canon 2026-08-25. APPLICATION_CUT remains only so old WO clothing phrases still strip.
- **COCCYX-OWN-S:** Keep ZONE-COCCYX. bel-oma does not include it. WO BodyParts id=9 Büzdüm sümüyü. 817 §14 is L1 to gluteal folds (region). Coccyx is a local point (Amplipuls/darsonval). WO 'büzdüm bel oma' → two chips.
- **BOYUN-VS-COLLAR:** Bare boyun = ZONE-COLLAR (Nafta reception: trapezius / scalenus collar patch). ZONE-NECK stays 817 §3 for explicit neck-only, no WO alias. Nafta reception 2026-08-25: boyun is the collar (trapezius / scalenus), not 817 §3 neck-only. Isolated WO boyun (88 rows) maps to COLLAR. baş boyun → HEAD+COLLAR.
- **SITZ-PANTIES-HIP:** Three codes. Do not collapse. oturaq 1361/235 is sitz bath (hydro fill). bud çanaq is 817 §22 joint + laterality (BodyParts sağ/sol). Panty is Shcherbak electrode girdle (lumbar + upper thighs), not a bath and not a hip joint. Rename hip so it never says oturaq.
- **STRIP-ORDER-TOKENS:** Match S only after stripping order-field tokens from the nahiye string. 4 cu rej / artroz rej / tens / növbəli / sağ-sol are not anatomy.
- **NEVBELI-SESSION-TURN:** növbəli is siteApplyMode=TURN on one ProcedureOrder (same slot, sites in listed order). Not two series and not sequenceIndex FIFO. WO stores növbəli on a single PatientProcedure row. sequenceIndex already means program FIFO (confirm order of procedure types). Day-rotate fill is BATH_SEQUENCE only (1 ci oturaq son tam). eyni vaxtda = TOGETHER.
- **RECEPTION-EMPTY-DEFAULTS:** When nahiye is empty, default S from procedure name (Nafta reception 2026-08-25). Yod-brom / hidromasaj / Massaj 30 / UFB / Bükmə → FULL-BODY. Limfodrenaj empty → LOWER-LIMB (add ABDOMEN if qarın marked). Massaj 15 still needs a region. Naftalan fill stays doctor-assigned (tam|oturaq|qurşaq).
- **ELECTRODE-VS-WORK-KIND:** 4 lü = 4 electrodes. 4 cu rej = Amplipuls work-kind IV. Never the same field. Textbook SMT I–V vs WO 4 lü on two sites and on electrophoresis.
- **EPHOR-SUBSTANCES:** kali yodla=ky-la=KI; kalsiilə/kalsiiləe=Ca; novakainlə=novocaine; karipazin/kariipazimlə=caripazim; dimeksid; hidrokortizon; maqni sulfat; mg-le=Mg; mazi ile=ointment. Elektroforez nahiye is drug + sites + optional 4 lü plates. L4 L5 is spine level, not regime IV.
- **NAFTALAN-TYPOS:** sonr4a=sonra; 1 ci dün=1-ci gün; siyine=çiyinə; qurşaqədər=qurşağa qədər; bədn=bədən; tan beden=tam; 4kamerali=four-chamber naftalan procedure. Reception 2026-08-25.
- **PARAFFIN-SKU:** Keep four paraffin SKUs. Extra nahiye (3 gün/5 gün, boyunçiyin, kurem) is order fields or sloppy SKU pick, not new procedures. WO writes combo sites on whichever paraffin row was handy.
- **HEAD-NOT-BIG-TOE:** Do not map whole-word bas to HEAD when barmaq is present (baş barmaq = hallux/thumb). Matcher bug: her iki ayaq bas barmaq → ZONE-HEAD.
- **BOYREKUSTU-IS-LUMBOSACRAL:** böyrəküstü / böyrək üstü = ZONE-LUMBOSACRAL (lumbar / above the kidneys). Not a new S. Reception closed 2026-08-25. Canon §6.2 no longer treats this as mint-queue anatomy.
- **BIZLER-IS-KNEE:** her iki bizler = hər iki diz → ZONE-KNEE. WO typo bizler.
- **SADE-NO-ADDITIVE:** İnqalyasiya + sadə = plain inhalation, no additive. Not a site. Flags-only / NO_ADDITIVE. Site is the procedure type.
- **KOTZ-NOT-SMT:** rus akimi = Kotz (Russian stimulation). seo/deo numbers are DEVICE_PARAMS, not Amplipuls I–V. BTL combo currents vs classic SMT work-kind.
- **UFB-START-TOKEN:** 0 24 başla / başlamaq on UFB is a session start token (DEVICE_PARAMS), not a site. UFB empty already defaults full body; this token is leftover regime text.
- **LONG-TAIL-STAYS-QUEUE:** Do not auto-mint S for fingers-as-named, quadriceps/biceps named muscles, or other long-tail anatomy. Unmatched queue is first-class. SatAdmin synonyms after review.
- **BTL-ELECTRO-US-CHANNELS:** Planning: four boxes, six couches. BTL 4000 between 7∥8 and between 10∥11 (2 paws/output; any electro procedures in parallel, same or different). UNISTIM 5S on 12 and BTL 4825S Premium on 13 (4 paws; also 2-pad; US on 4825S unused). FIFO only: 12/13 are ordinary 2-pad resources — do not hold for 4 lü. 4 lü / 4-pole IFC → 12 or 13 when free (capability, not priority). Cabin 14 not in ERA. US/UFF 15–16 oil, 17 gel. One electro nurse on all six couches. Separate ProcedureTypes, shared resources. Cutover #40 LOCATION pool stays 7–13. Floor wiring + med brother 2026-08-26. Placement is FIFO (placeConfirmedProcedures). Not runtime schema until the resource wave.
- **BELOW-KNEE-IS-FOOT-LEG:** dizdən aşağı / dizlərdən aşaği / asagi eyaqlar = below the knee → ZONE-FOOT-LEG. Not ZONE-LOWER-LIMB (that includes thigh). Reception 2026-08-25. Paraffin bütün bədən + below-knee nahiye is sloppy SKU, site still FOOT-LEG.
- **BALDIR-NOT-THIGH:** baldır = crus (ZONE-FOOT-LEG). bud / bud nahiyəsi = thigh → ZONE-HIP-GLUTEAL. Not interchangeable. Russian ляжка is bud, not baldır.
- **ARTROZ-PR-NOT-PRP:** artroz pr / artrit rej / artroz b rej / (b) = named stim program on the combo. Not PRP. PRP is SVC-PRP-TERAPIYA. pr = proqram; (b) = protocol B. Same rows as TENS / 4 basliqli.
- **NO-BARE-AYAQLAR-AS-AYA:** Leftover ayaq / eyaq after laterality = ZONE-LOWER-LIMB (sol ayaq = left leg). ayaqlar alti = sole → ZONE-FOOT-LEG. Hallux phrases (ayaq bas barmaq) stay longer and still win. Reception 2026-08-26. Bare ayaq is leg unless a longer foot/toe phrase matches.
- **QUAD-IS-THIGH-NOT-NEW-S:** quadriseps / hamstring → ZONE-HIP-GLUTEAL (thigh). Do not mint a muscle S. Bare biceps is not arm when next to quad (biceps femoris) — only via composite. Reception 2026-08-25. Rotator cuff (supra/infraspinatus) still unmatched.
- **LASER-NAMED-PROGRAMS:** ödem pr / dermo rej / ekzema pr / artrit rejimilə / artroz pr (b) are named device programs (often Lazerterapiya). Same DEVICE_PROGRAM field. Not PRP, not S. Do not alias bare pr. pr = proqram. Laser SKU is separate; nahiye holds the template name.
- **TURUNDA-IS-PROCEDURE:** turunda / tampon = tampon procedure, not a site. Remaining tokens (qulaq / burun) are the S. SVC-TURUNDA-BURUN-VE-QULAQ.
- **CHAMOMILE-ADDITIVE:** çoban yastığı = chamomile additive (inhalation), not a site. Same class as bitkilərlə.
- **AXILLA-COARSE-UPPER-LIMB:** qoltuqaltı → ZONE-UPPER-LIMB. No dedicated axilla S. Not in the 31 protocol sites.
- **TOPUQ-IS-ANKLE:** ayaq topuqlarina = malleolus / ZONE-ANKLE (bump by Achilles), not a new foot point. Heel stays daban. Reception 2026-08-25.
- **DIZ-OYNAGI-IS-KNEE:** diz oynagi / diz oynağı / dizətrafi = ZONE-KNEE (knee joint / peri-knee). Not a ligament S. dizəqədər = ZONE-FOOT-LEG (to the knee). Reception 2026-08-26. Same 817 §23 site.
- **NO-BARE-ASAGI-HISSESI:** aşagi hissəsi / aşagi hissə = APPLICATION_SURFACE (lower portion of the already chosen S), not a new zone. Do not alias bare aşağı / aşagi (ambiguous низ). Reception 2026-08-26. yuxari hissə is the same class (upper portion).
- **SARGI-STAYS-QUEUE:** sargi nahiyyesi is a dressing/bandage area, not an 817 S. Unmatched queue. Reception 2026-08-26.
- **KUREKALTI-IS-BACK:** kürəkalti = subscapular → ZONE-BACK. qabırğa üstü → ZONE-CHEST. Not extra S codes. Reception 2026-08-26.
- **DUMBEK-IS-LUMBOSACRAL:** dumbek / dumbek nahiyesi = sacrum → ZONE-LUMBOSACRAL (lumbosacral includes sacrum). Not coccyx (büzdüm), not perineum. Reception 2026-08-26. Clarified as крестец, still the same 817 lumbosacral S.
- **VENA-STAYS-QUEUE:** venalara = veins, not an 817 S. Unmatched queue. Do not map to a limb. Reception 2026-08-26.
- **OMA-IS-LUMBOSACRAL:** oma = omba = ZONE-LUMBOSACRAL (same as bel oma). Not a new S. Reception 2026-08-26.
- **DOS-IS-CHEST:** doş / dos / döş = chest (ZONE-CHEST). döş qəfəsinə qədər ombaya olmaz on Parafin Yuxarı = apply to chest, HOLD lumbar. Reception 2026-08-26.
- **HISSE-IS-SURFACE:** aşagi hissəsi / yuxari hissə = APPLICATION_SURFACE (lower/upper portion of the already chosen S). Not LOWER-LIMB / UPPER-LIMB. Bare aşağı still unmatched. Reception 2026-08-26.
- **ATRAFLAR-IS-AROUND:** ətraflar = around (stop word). Longer asagi etraflara / yuxari etraf still win as limb S. Reception 2026-08-26.
- **FOUR-HEAD-CERVICAL-LUMBAR:** 4 basliql hem servikal hem lumbar / 4 basliqli … boyun … bel oma = COLLAR + LUMBOSACRAL + 4-pad. karipazin/dimeksid stay substance. iki basligi / basligi = electrode tokens, not anatomy. Reception 2026-08-26.
- **BAS-BARMAQ-DIGIT:** baş barmağa / bas barmaga = hallux or thumb (ZONE-FOOT-LEG / already chosen digit S). AZ baş barmaq is not index finger. Do not mint a finger S. Reception 2026-08-26 (указательный in the note = that digit, not a new code).
- **BAZU-IS-UPPER-LIMB:** bazu nahiyəsi = brachium (humerus, elbow to shoulder) → ZONE-UPPER-LIMB. No dedicated arm-bone S. Reception 2026-08-26.
- **CANAQDAN-ASAGI-LOWER:** canaqdan aşağı = below the pelvis → ZONE-LOWER-LIMB (includes thigh). Not FOOT-LEG. canaq / çanaq itself stays HIP-GLUTEAL. Reception 2026-08-26.
- **PROTOCOL-B-IS-PROGRAM:** artroz/artrit … (b) / brej / b rej = named stim program variant B. Same DEVICE_PROGRAM field. Isolated letter b is not a token. Reception 2026-08-26. WO writes (b) on many arthritis/artrosis rows.
- **ART-IS-ARTROZ-PROGRAM:** leftover art after a site (e.g. onurga boyu art) = artroz program, not a new S. Reception 2026-08-26.
- **NO-BARE-ALTI-FIELD:** x altı = under that S (daban altı / ayaqaltı = sole; diz altina = under the knee). Do not strip generic altı as a field — it would steal sole phrases into leftover ayaq = LOWER-LIMB. Reception 2026-08-26.
- **FURUN-IS-NOSE:** furun in nahiye = burun (nose) → ZONE-FACE. Not turunda/tampon unless turunda is also written. Reception 2026-08-26.
- **RALOJI-IS-NEVRALOJI:** raloji rej on Elektroforez = nevraloji (neurological stim program), not radiology. Same DEVICE_PROGRAM as nevraloji rej. WO 11 rows, same doctor as KY/BEF yaxaliq + nevraloji rej on Elektroforez. Reception thought radiological; procedure is electrophoresis.
- **EKSTREMITE-IS-LIMB:** ekstremite = limb(s). aşağı/alt ekstremite → ZONE-LOWER-LIMB. yuxarı ekstremite → ZONE-UPPER-LIMB. Bare ekstremite = both limbs (composite). Not a new S. Reception 2026-08-26 (TR/LAT: kol ve bacak).
- **ERECTOR-IS-SPINE:** erector spina para vertebral = paravertebral erector spinae → ZONE-SPINE-FULL. Latin anatomy, not a new S. Reception 2026-08-26.
- **DIZALTI-IS-KNEE:** dizaltı / dizalti = under the knee → ZONE-KNEE. dizdən aşağı = below the knee → ZONE-FOOT-LEG. Not the same. Reception 2026-08-26.
- **FOUR-LU-REJ-IS-PADS:** 4 lü rej = 4-electrode regime → ELECTRODE_COUNT. Still not Amplipuls work-kind IV (that is 4 cu rej). Reception 2026-08-26.
- **ONE-CI-IS-FIRST:** 1 ci / 1-ci = first (day or first sitz). 1 ci oturaq = first sitz, not BATH_SEQUENCE (that needs son tam). Longer 1 ci rej still wins as work-kind I. Reception 2026-08-26.
- **NELOMA-IS-BELOMA:** neloma / meloma = beloma typo → ZONE-LUMBOSACRAL. Not melanoma. Keyboard neighbours n/m vs b. Reception confirmed 2026-08-26. WO is Amplipuls (4 cu rej) and Super induktiv terapiya, not oncology.
- **ASAGI-NAHIYE-LOWER:** asagi nahiye on Parafin Aşağı = ZONE-LOWER-LIMB (the lower-body paraffin site), not a surface-only flag. Reception 2026-08-26. Same SKU already named Aşağı nahiyə.
- **ROTATOR-CUFF-IS-SHOULDER:** supraspinatus / infraspinatus (insraspinatus) → ZONE-SHOULDER. Latin muscle names, not a new S. Reception 2026-08-26. Amplipuls interferential on those muscles.
- **MALLEOL-IS-ANKLE:** lateral/medial malleol = malleolus → ZONE-ANKLE. Reception 2026-08-26.
- **THORAKAL-IS-CHEST:** thorakal / torakal = thorax → ZONE-CHEST. Reception 2026-08-26.
- **ACHILLES-IS-FOOT:** axil veteri = Achilles tendon → ZONE-FOOT-LEG (shockwave). Not a new S. Reception 2026-08-26. Zərbə dalğa rows.
- **HEART-MASSAGE-CHEST:** ürək nahiyəsi after open-heart surgery = ZONE-CHEST + light INTENSITY + HOLD no pressure. Not a new heart S. Reception 2026-08-26. Massaj 30.
- **SAGRI-IS-HAUNCH-NOT-BANDAGE:** sagri = sağrı (haunch / HIP-GLUTEAL). sarğı (bandage) is sargi / sagir nah — unmatched queue. Do not conflate. Reception 2026-08-26 wrote sagri = sarğı; WO shows bilateral sagri + karipazim and bud/çanaq/diz pairs — that is sağrı, not a dressing.
- **QOLLARDAN-ASAGI-HAND:** qollardan aşağı on Parafin Yuxarı + tam onurga = distal to the upper arm → ZONE-HAND-FOREARM (forearm/hand), simultaneous with spine. Not lower-limb (wrong SKU). Reception 2026-08-26 unsure. Distal reading fits upper paraffin; torso-below-axilla would duplicate the spine chip.
- **SAKRUM-IS-LUMBOSACRAL:** sakrum = sacrum → ZONE-LUMBOSACRAL (same as dumbek). Not coccyx. Reception 2026-08-26.
- **YUXARI-ON-PARAFIN-SKU:** boyun yuxari bel / yuxari boyun on Parafin Yuxarı: yuxarı echoes the SKU. Sites are COLLAR (+ LUMBOSACRAL if bel). Do not treat leftover yuxari as UPPER-LIMB. Reception 2026-08-26: procedure name already has upper.
- **QILLAR-IS-QOLLAR:** qıllar / qillara = qollar (keyboard i vs o) → ZONE-UPPER-LIMB. Not body hair. Reception 2026-08-26: letters are neighbours. Same pattern as neloma/beloma.
- **CAPIQ-REJ-IS-SCAR-PROGRAM:** capiq rej / çapıq rejim = scar (keloid) device program, same field as kelloid capiq pr. Not a site. Reception 2026-08-26 unsure of the word; Azerbaijani çapıq = scar. WO pairs it with artroz b rej on knees + abdomen.
- **FONOFAREZ-IS-UFF-BLEED:** fonofarez / fonoforez in nahiye = Ultrafonoforez written into the site field. PROCEDURE_NAME_BLEED, not a zone. Reception 2026-08-26. Catalog SKU is Ultrafonoforez (Naftalan yağıyla / Gellə).
- **FOUR-LU-REJIM-IS-PADS:** 4 lü rejim = 4-electrode count, same as 4 lü. Not Amplipuls IV (4 cu rej) and not a named DEVICE_PROGRAM leftover. Reception 2026-08-26.
- **ARTROZ-B-IS-PROGRAM-VARIANT:** artroz rej b / artrit pr ilə(b) / leftover (b) = named stim/laser program variant B. Keep as DEVICE_PROGRAM. Isolated b is not anatomy. Meaning of letter B inside the device menu is still unknown. Reception 2026-08-26 cannot yet name what B is; WO writes it on artroz/artrit rows only.
- **BUTUN-VS-BURUN:** leftover butun is NOT a blind stop. t/r are neighbours: butun may be bütün (all) or burun (nose). If another site is already matched (butun ayaqlar) = bütün of that site. Bare butun on Massaj 30 / UFB / Parafin bütün = FULL-BODY. Bare butun on Trunda/turunda/İnqalyasiya = ZONE-FACE. Without a SKU, leave unmatched. Reception 2026-08-27. WO today: butun beden = Massaj 30 + UFB; butun ayaqlar = İnfraqırmızı. No butun on turunda yet.

## S zones

| Code | Kind | 817 | Laterality | AZ (draft) | RU | LA | Coarse | WO aliases |
|------|------|----:|:----------:|------------|----|----|--------|------------|
| `ZONE-HEAD` | USSR-817 | 1 | — | Baş | Голова | *Caput* | HEAD | basina; baş; başa; basa; bsina; başına; basin; abasin |
| `ZONE-SCALP` | HYDRO | — | — | Başın tüklü hissəsi | Волосистая часть головы | *Regio capillata capitis* | HEAD | başin tüklü hissəsi; başin tüklü hissəsinə; basin tuklu nahiyesine; basin tuklu hissesi; baçin tüklü hissəsinə; baçin tüklü hissəsi; basin tuklu nahiyesi; basin tuku nahiyyesi; basin tuklu; basin tuku; basin yuklu; basin tuklu hissesei; basin tuklu hisesi; saçina; saçlarina; sacina; sac; saç |
| `ZONE-FACE` | USSR-817 | 2 | — | Üz | Лицо | *Facies* | HEAD | çənə; cene; üz nahiyəsi; uz nahiyesi; üz; burun alin; alın; üzə; uze; burun; buruna; elave uzede; elave uzə; uzede; furun |
| `ZONE-NECK` | USSR-817 | 3 | — | Boyun | Шея | *Collum* | NECK |  |
| `ZONE-COLLAR` | USSR-817 | 4 | — | Yaxalıq (boyun-çiyin) nahiyəsi | Воротниковая зона | *Regio cervicalis posterior et pars superior dorsi* | NECK, BACK, CHEST | kurek boyun ciyinlere; kurek boyuna; boyun çiyin; kurek ciyinlere; kürək çiyinlər; yaxaliq; yaxalıq; yaxaliq nahiyesine; vorotnik; varatnik; boyun; boyunçiyin; boyunciyin; boyun ciyin; kurek boyun; abefayaxaliq; bef; boun; boynundaki; trapez; trapez ezeleler; kurrek boyun; kurek biyuna; varatnik formada; boyuna; bpyun; varatniik; boy6un; biyun; boyuyn; boyin; boyn; servikal; boyun ardina; boyun ardına; boynuna |
| `ZONE-UPPER-LIMB` | USSR-817 | 5 | yes | Yuxarı ətraf | Верхняя конечность | *Membrum superius* | ARM_LEFT, ARM_RIGHT | qollara; qollar; qolara; qollarin ic; qollarin iç; qolarda; yuxari etraf; yuxarı ətraf; yuxari nahiye; yuxarı nahiye; qoltuqalti; qoltuqaltı; qolar; qol; bazu; bazu nahiyəsi; bazu nahiyesi; qoltuq altina; qoltuq altına; qollarara; yuxari ekstremite; yuxarı ekstremite; qolla; qola; gollar; qolu; qillar; qillara |
| `ZONE-UPPER-LIMB-SCAPULA` | USSR-817 | 6 | yes | Yuxarı ətraf, çiyin və kürək | Верхняя конечность, надплечье и лопатка | *Membrum superius et scapula* | ARM_LEFT, ARM_RIGHT, BACK |  |
| `ZONE-SHOULDER` | USSR-817 | 7 | yes | Çiyin oynağı | Плечевой сустав | *Articulatio humeri* | ARM_LEFT, ARM_RIGHT | ciyinlere; çiyinlər; çiyin; ciyine; ciyn; çiyn; siyine; şiyinə; ciyiner; ciyuinlere; çiyuinlərə; çiyuin; çiynlər; çiyionlər; çiyinləriə; çiyinlərə; çmiyinlər; supraspinatus; insraspinatus; infraspinatus; ciyin lere; ciyuna; cuyinlere; coyinlere |
| `ZONE-ELBOW` | USSR-817 | 8 | yes | Dirsək oynağı | Локтевой сустав | *Articulatio cubiti* | ARM_LEFT, ARM_RIGHT | dirseklere; dirsəklər; dirsək; dirsekler; dirseye; dirsekden asagi; dircek; dirceye; disəklər; diraeklere; dirsəklərə; sadirsek |
| `ZONE-WRIST` | USSR-817 | 9 | yes | Bilək oynağı | Лучезапястный сустав | *Articulatio radiocarpalis* | ARM_LEFT, ARM_RIGHT | əl biləyi; bilək; bileklere; biləklər; bilekler; biləklərə; biləyə; bileye |
| `ZONE-HAND-FOREARM` | USSR-817 | 10 | yes | Əl və önqol | Кисть и предплечье | *Manus et antebrachium* | ARM_LEFT, ARM_RIGHT | əllər; eller; ellere; ovuc ici; elcek; əlcək; elller; elleri; el barmaq; əl barmaq; qollarin ic terefi; el barmaqlari; əl barmaqlari; el; əl; ellerin icine; ellerin içine; ellerein icine; ələrin içi; elerin ici; ovuclar; ovuclarin; eller ustune; əllər üstünə; əllərə; eline; əlinə; qollardan asagi; qollardan aşağı; əllərin içi; ellerin ici |
| `ZONE-CHEST` | USSR-817 | 11 | — | Döş qəfəsi | Грудная клетка | *Thorax* | CHEST, BACK | sine; sinə; sinəyə; sineye; dos qefesi; döş qəfəsi; dos qefesinin; döş qəfəsinin; sud vezi; süd vəzi; sud vezinin altina; süd vəzinin altina; qabirga üstü; qabırğa üstü; qabirgaustu; doş qefesi; doş; dos; doş qefesində; döş qəfəsində; dos qefesine; urek; ürək; thorakal; torakal |
| `ZONE-BACK` | USSR-817 | 12 | — | Kürək | Спина | *Dorsum* | BACK | kurek; kürəyə; kürək nahiyəsi; kürək bütöv; kürəyin yuxari hissəsi; kurem; kueye; kürəyin yuxari; küək; hurek; kureek; kürəjk; kürəkalti; kurekalti; kürək altı; kurrk; kureyine; kürəklərə; kürəyin; kureyin; krek; kurel; kürəy6ə; lotissimus dorsi; latissimus dorsi |
| `ZONE-ABDOMEN` | USSR-817 | 13 | — | Qarın | Передняя брюшная стенка | *Paries anterior abdominis* | ABDOMEN | qarin; qarın; qarina; qarinin; q1arin; gobek; göbək; gobeye; göbəyə |
| `ZONE-LUMBOSACRAL` | USSR-817 | 14 | — | Bel-oma nahiyəsi | Пояснично-крестцовая область | *Regio lumbosacralis* | BACK | beloma nahiyesine; bel oma; beloma; bel oma nahiyəsi; bel oma nahiyyesi; bel; lombal; lumbar; beloma nahiyyesi; bel nahiyesine; bel nahiyəsi; böyrəküstü; böyrək üstü; boyrekustu; boyrek ustu; böyrəküstü nahiyə; böyrək üstü nahiyə; bel omba; bei oma; belomba; bel olma; beol oma; bel olam; dumbek; dumbek nahiyesi; oma; neloma; meloma; sakrum; öyrəküstü; oyrekustu |
| `ZONE-BACK-AND-LUMBAR` | USSR-817 | 16 | — | Kürək və bel | Спина и поясница | *Dorsum et regio lumbalis* | BACK | kürək bel oma; kurekbel oma; kürəkbel oma; belinə və kürəynə |
| `ZONE-CERVICOTHORACIC` | USSR-817 | 17 | — | Boyun-döş onurğa | Шейно-грудной отдел позвоночника | *Columna vertebralis cervicalis et thoracica* | NECK, BACK |  |
| `ZONE-SPINE-FULL` | USSR-817 | 19 | — | Onurğa boyu (tam sütun) | Область позвоночника (вдоль столба) | *Columna vertebralis* | NECK, BACK | feqere sutunu boyunca; onurga boyu; tam onurga; onurga boyu bel oma; onurga; feqere sutunu; feqere sut; onurqa boyu; feqere sut boyunca; feq sut boyunca; onurqa; onurganin etrafina; onurga kenarlarina; onurga kənarlarina; 0nurga boyu; onurganin usdune; onurganin üstünə; oonurga; onurğa; onurgqa boyu; erector spina para vertebral; erector spina; para vertebral; paravertebral; ourga; ourga boyu; onuga; onurha; onuga boyu; onurga boyui; oonurga boyu; onurğa boyu; sutunu boyu; sütünü boyu; sütunu boyu; feqere surunu; fegere sutu; fəgərə sutu; fəgərə sütunu; fegere sutunu |
| `ZONE-LOWER-LIMB` | USSR-817 | 20 | yes | Aşağı ətraf | Нижняя конечность | *Membrum inferius* | LEG_LEFT, LEG_RIGHT | ayaqlara; ayaqlar; eyaqlar; asagi etraflara; aşagi ətraflar; ayyaqlar; asagi etraf; ayaqlarina; ayaqlari; asadi etraflara; asaqi etraflara; asagi ereadflara; asagi etraflapa; asafi etraflara; asasagi etraflara; aşagii ətraflar; asahi etraflara; asagi etraglara; dizden yuxari; dizdən yuxarı; ayaqklae; eyaq; ayaq; ayalar; ayaqolar; canaqdan asagi; çanaqdan aşağı; asagi ekstremite; aşağı ekstremite; alt ekstremite; ayaga; ayağa; asagi nahiye; aşağı nahiyə; belden aşaği; beldən aşağı; ayaqlart; ayaqlaqra; ayaqlaer; ayaqloar; asagi etraflr; aşağı ətraflar |
| `ZONE-LOWER-LIMB-LUMBAR` | USSR-817 | 21 | yes | Aşağı ətraf və bel | Нижняя конечность и поясница | *Membrum inferius et regio lumbalis* | LEG_LEFT, LEG_RIGHT, BACK |  |
| `ZONE-HIP-GLUTEAL` | USSR-817 | 22 | yes | Bud-çanaq oynağı | Тазобедренный сустав и ягодичная область | *Articulatio coxae et regio glutealis* | LEG_LEFT, LEG_RIGHT | bud canaq; bud çanaq; bud çanağı; sagri; bud canag; budçanaq; bud; bud nahiyesi; bud nahiyəsi; bud ezeleleri; canaq; çanaq; çanaq nahiyəsi; budun; quadriseps; quadriseps ezeleler; hamstring; canag; canaga; çanağa; canaqlara; çanaqlara; budhissesi; bud hissesi; bud hissəsi; şanaq; sanaq; bbud |
| `ZONE-KNEE` | USSR-817 | 23 | yes | Diz oynağı | Коленный сустав | *Articulatio genus* | LEG_LEFT, LEG_RIGHT | dizlere; dizler; dizlərə; dizlər; dozlere; diz; deiz; dizllere; dizseklere; dize; dizine; dizi; bizler; bizlere; deizlere; deizlərə; dizin; edizlər; diz oynagi; diz oynağı; diz oynagı; dizətrafi; diz etrafi; dizətrafı; dizlier; dizarxasi; diz arxasi; di8zlər; di8zler; diz usdu; diz üstü; dizlerin altina; dizlərin altina; dizlərinin altina; dizlerinin altina; dizalti; dizaltı; qizlere |
| `ZONE-ANKLE` | USSR-817 | 24 | yes | Aşil / topuq oynağı | Голеностопный сустав | *Articulatio talocruralis* | LEG_LEFT, LEG_RIGHT | topuqlara; topuq; aşil; asil; topuqlar; topuga; topug; topuqla; topuqlarina; ayaq topuqlarina; toppug; topuq lara; topulara; topuglara; yopuqlara; malleol; lateral malleol; medial malleol; medial lateral malleol |
| `ZONE-FOOT-LEG` | USSR-817 | 25 | yes | Ayaq və baldır | Стопа и голень | *Pes et crus* | LEG_LEFT, LEG_RIGHT | daban; dabanlara; dabanlar; ayaqalti; ayaq alti; pence; baldir; dabana; corab; bas barmaq; baş barmaq; ayaq barmaq; ayaqbarmaqlari; ayaq pencesine; ayaqüstü; ayaq bas barmaq; ayaq bas barmaqlari; baldirin; penceler; pəncələr; dizden asagi; dizdən aşağı; dizlerden asagi; dizlərdən aşaği; asagi eyaqlar; asagi ayaqlar; pencelere; baldirlara; ayaqaltina; dizəqədər; dizeqeder; dizə qədər; pəncəyə; penceye; ayaqlar alti; ayaqlaraltı; daban arxasina; ayaqlarin altina; bas barmaga; baş barmağa; ayaq barmaqlari; ayaq barmaqları; ayaqqalti; ayaqaltii; daban alti; ayaqlarinin altina; baldirlar; ayaqbarmaqlar; dizdən aşagi; ayaqbarmaqlarina; axil veteri; axil vətəri; axilles; pen cesine; pəncəsinə; baldira; baldıra; dizdən aşagı |
| `ZONE-PANTIES` | SHCHERBAK | — | — | Tuman (trusi) zonası | Трусиковая зона (гальванический пояс по Щербаку) | *Regio lumbosacralis et femora proxima* | BACK, LEG_LEFT, LEG_RIGHT | trusi; tuman; трусиковая; panty |
| `ZONE-SITZ` | HYDRO | — | — | Oturacaq / oturaq vanna | Сидячая ванна | *Balneum sessile* | BACK | oturaq; otraq; oturaq qursaga kimi; 0turaq; oturuaq; 3oturaq; 3 oturaq; oturuaq vanna; oturaq vanna; 1 ci oturaq; 1-ci oturaq |
| `ZONE-TO-WAIST` | HYDRO | — | — | Qurşağa qədər | До пояса | *Balneum ad cingulum* | ABDOMEN, LEG_LEFT, LEG_RIGHT, BACK | qursaga kimi; qurşagaqədər; qurşagadək; qursaq; qursadek; qursaga qeder; qurşaqədər; qurşağa qədər; qursagagadek; oturaqqursaga kimi; oturaq qursaga kimi |
| `ZONE-FULL-BODY` | HYDRO | 26 | — | Tam bədən | Общая (всё тело) | *Corpus totum* | FULL_BODY | tam; tam bədən; tam beden; umumi; butun beden; bütün bədən; tan beden; tam bedn; tam bədn; beden; bədən; bedenin; bədənin; bədəənin; baden |
| `ZONE-FOUR-CHAMBER` | HYDRO | — | — | 4 kameralı vanna | Четырёхкамерная ванна | *Manus et pedes (balneum quadriloculare)* | ARM_LEFT, ARM_RIGHT, LEG_LEFT, LEG_RIGHT | 4 kamerali vanna; 4 kamera; 4 kamerali; 4kamerali; 4 kameri; 4 kamerali banna |
| `ZONE-COCCYX` | LOCAL | — | — | Büzdüm sümüyü | Копчик | *Os coccygis* | BACK | büzdüm sümüyü; büzdüm |
| `ZONE-EAR` | LOCAL | — | yes | Qulaq | Ухо | *Auris* | HEAD | qulaq; qulaga; qulaqlar; qulagin; qulağın |

## A underlay (FMA/TA hints)

| S | Anatomy | TA | FMA id |
|---|---------|----|--------|
| `ZONE-HEAD` | Head | *Caput* | FMA:7154 |
| `ZONE-SCALP` | Scalp | *Scalp* | FMA:54237 |
| `ZONE-FACE` | Face | *Facies* | FMA:24763 |
| `ZONE-NECK` | Neck | *Collum* | FMA:7155 |
| `ZONE-COLLAR` | Cervical region of back | *Regio cervicalis* | TBD BioPortal |
| `ZONE-COLLAR` | Trapezius | *M. trapezius* | FMA:9625 |
| `ZONE-COLLAR` | Scalene muscles | *Mm. scaleni* | TBD BioPortal |
| `ZONE-UPPER-LIMB` | Upper limb | *Membrum superius* | FMA:7183 |
| `ZONE-UPPER-LIMB-SCAPULA` | Upper limb | *Membrum superius* | FMA:7183 |
| `ZONE-UPPER-LIMB-SCAPULA` | Scapula | *Scapula* | FMA:13310 |
| `ZONE-SHOULDER` | Glenohumeral joint | *Articulatio humeri* | FMA:25580 |
| `ZONE-ELBOW` | Elbow joint | *Articulatio cubiti* | FMA:34898 |
| `ZONE-WRIST` | Radiocarpal joint | *Articulatio radiocarpalis* | FMA:25521 |
| `ZONE-HAND-FOREARM` | Hand | *Manus* | FMA:9712 |
| `ZONE-HAND-FOREARM` | Forearm | *Antebrachium* | FMA:24923 |
| `ZONE-CHEST` | Thorax | *Thorax* | FMA:11391 |
| `ZONE-BACK` | Back | *Dorsum* | FMA:14181 |
| `ZONE-ABDOMEN` | Anterior abdominal wall | *Paries abdominalis anterior* | FMA:25905 |
| `ZONE-LUMBOSACRAL` | Lumbar region of back | *Regio lumbalis* | TBD BioPortal |
| `ZONE-LUMBOSACRAL` | Sacral region | *Regio sacralis* | TBD BioPortal |
| `ZONE-BACK-AND-LUMBAR` | Back | *Dorsum* | FMA:14181 |
| `ZONE-BACK-AND-LUMBAR` | Lumbar region of back | *Regio lumbalis* | TBD BioPortal |
| `ZONE-CERVICOTHORACIC` | Vertebral column | *Columna vertebralis* | FMA:13478 |
| `ZONE-SPINE-FULL` | Vertebral column | *Columna vertebralis* | FMA:13478 |
| `ZONE-LOWER-LIMB` | Lower limb | *Membrum inferius* | FMA:7184 |
| `ZONE-LOWER-LIMB-LUMBAR` | Lower limb | *Membrum inferius* | FMA:7184 |
| `ZONE-LOWER-LIMB-LUMBAR` | Lumbar region of back | *Regio lumbalis* | TBD BioPortal |
| `ZONE-HIP-GLUTEAL` | Hip joint | *Articulatio coxae* | FMA:25511 |
| `ZONE-HIP-GLUTEAL` | Gluteal region | *Regio glutealis* | TBD BioPortal |
| `ZONE-KNEE` | Knee joint | *Articulatio genus* | FMA:32564 |
| `ZONE-ANKLE` | Ankle joint | *Articulatio talocruralis* | FMA:35179 |
| `ZONE-FOOT-LEG` | Foot | *Pes* | FMA:9664 |
| `ZONE-FOOT-LEG` | Leg | *Crus* | FMA:24979 |
| `ZONE-PANTIES` | Lumbar region of back | *Regio lumbalis* | TBD BioPortal |
| `ZONE-PANTIES` | Sacral region | *Regio sacralis* | TBD BioPortal |
| `ZONE-PANTIES` | Thigh | *Femur (regio femoralis)* | FMA:24967 |
| `ZONE-SITZ` | Pelvis | *Pelvis* | FMA:9578 |
| `ZONE-TO-WAIST` | Lower half of body | *Dimidium inferius corporis* | TBD BioPortal |
| `ZONE-FULL-BODY` | Human body | *Corpus humanum* | FMA:20394 |
| `ZONE-FOUR-CHAMBER` | Hand | *Manus* | FMA:9712 |
| `ZONE-FOUR-CHAMBER` | Foot | *Pes* | FMA:9664 |
| `ZONE-COCCYX` | Coccyx | *Os coccygis* | FMA:20229 |
| `ZONE-EAR` | Ear | *Auris* | FMA:52780 |

FMA ids are lookup hints — confirm before seed. Not SNOMED.

## Not zones (stay on the order)

| Code | Meaning | WO text |
|------|---------|---------|
| `SEQUENCE_ALTERNATING` | Apply listed S sites in turn, not one combined patch | növbəli, nobeli, novbe, novb, novbeli, noybeli, novvbeli, novbveli, novcvbeli, növbvəli, növbəlii, novbelii, övbəli, ovbeli, növəli, noveeli, vobeli, növbli, novveli, novbre, nibeli, novbelilar, növbəlilar, novbe, nov |
| `SEQUENCE_SIMULTANEOUS` | Several S in one session as one combined application. Default when multiple chips without növbəli. | eyni vaxtda, eyni vaxda, eyni zamanda, eyni anda, eyni zaman, eyni vaxti, eyni enda |
| `LATERALITY` | NONE | LEFT | RIGHT | BILATERAL | sağ, sol, saq, her iki, hər iki, heriki, hər ikisi, her ikisi, hər ikisinə, her ikisine, hir iki, hiriki, ker iki, keriki, so, hər4 iki, her4 iki, hər ki, her ki, her etrafa, hər ətrafa |
| `AMPLIPULS_WORK_KIND` | Amplipuls SMT роды работы I–V. WO 4 cu rej = IV, 2 ci rej = II. Not electrode count. | 4 cu rej, 4 cü rej, 4cü rej, 4cu rej, 4 -cu rej, 4 cü rejimlə, 2 ci rej, 2-ci rej, 2 ci rejim, 1 ci rej, 3 cu rej, 5 ci rej, 4 cu re j, 4-cü rej, 4 cu re, 2 ci re, 4- rej, 4-rej |
| `DEVICE_PROGRAM` | Named program/current on the stim (not Amplipuls I–V): TENS, Kotz, interferential, artroz/artrit templates. artroz pr = proqram, NOT PRP. | tens proqrami ile, tens proqrami ilə, tens proqrami, tens proq, tens üsulu ilə, tens usulu ile, tens üsulu, tenslə, tens le, tens rej, tenis rej, tens, artroz rej b, artroz reh, artroz rej, capiq rej, capiq rejim, çapıq rejim, çapıq rej, artroz proqrtami ile, artroz proqrtamı ilə, ekzem proqramiyla, ekzem proqramı ilə, artroz, dermatit, artroz pr ilə, art pr ilə, artrit pr ilə, padaqra rej, podaqra, tens proqtami ile, tenis, nevraloji rej, nevroloji rej, rus akimi ilə, rus akimi ile, rus akimi, rus akiimi, artrit proqramile, artrit proqrami ilə, artrit proqrami ile, artrit proqrami ile b, artrit proqrami ilə(b), artrit proqrqmi, artrit proq, artroz rej brej, artroz proqrami ilə(b), artroz proqrami ile b, rej brej, b rej, brej, oriqrami, proqrami ole, proqrami ilə, proqrami ile, proqram ilə, proqram ile, proqramla, proq ile, proq ilə, proqrami, rozesea proqrami, rozasea proqrami, art rejimilə, art rejimile, rejimilə, rejimile, rejimi ilə, rejimi ile, qartroz, ortrit pr, odem usulu, ödem üsulu, enterferensial proqramo, rejim, rej, dermo pr ilə, dermo pr ile, dermo, art, artroz b rej, artrir b rej, artrit rej, artrit, artr pr, ekz rej, ekzo rej, spor rej, ionofarez, iyontofarez, ionoforez, enterferensial proqrami, enterferensial, miospazm rejimiylə, miospazm rej, agri rejimi, lumbalgiya, ekzem pr ilə, eqzem pr ile, eqzema rej, ekzema proqrami, padaqra re, raloji rej, artrit proqramiyla, artrit proqramıyla, artrroz pr ilə, artrroz pr ile, astroz rej, prpqrami, dermatit pr ile, pr ile, pr ilə, odem pr ile, ödem pr ilə, odem pr, ekz pr ile, ekz pr, ekzema pr ile, dermo rej, artrit rejimile, artrit rejimilə, proqramiyla, kelloid capiq pr, artroz re, artrooz rej, artroz proqrami, artroz pr ilə(b), art pr ilə(b), art pr ile b, artroz pr ile b, artrit pr ile b, artrit pr ilə b, artrit pr ilə(b), b, ekzem proqrami, dermatit proqrami ilə, dermatit proqrami, dermatit pr il, rematidniy artrir b rej, rematidniy artrit b rej |
| `ELECTRODE_COUNT` | 2 vs 4 plates (WO 4 lü, 2 li, 4 basliqli). Not Amplipuls work-kind IV. 2-pad: all six electro couches (12/13 as 2 of 4). 4-pad capability: 12/13 when free. FIFO; do not hold 12/13. | 4 lü, 4 lu, 4lü, 4lu, 2 li, 2'li, 4 basliqli, 4 basliql, iki basligi, basligi, 4 lü rejim, 4 lu rejim, 4lü rejim, 4 lü rej, 4 lu rej, 4lü rej |
| `DEVICE_PARAMS` | Frequency / pulse / duration tokens — ProcedureType, not S | 1 mhz, 1mhz, 3 mhz, 3mhz, 1 5 mhz, 1.5 mhz, 1-5 mhz, kəsikli, kesikli, aşağı tezlikli, aşagi tezlikli, asagi tezlkli, aşağı tezlkli, asagi tezlikle, frekansla, frekans, 90 100 frekans, 90-100 frekans, açagi tezlikli, asagi tezlik, aşağı tezlik, asagi tezli, aşağı tezli, yuxari tezlikle, yuxari tezlikli, yuxarı tezlikli, 15-20 de, 15 20 deqe, 15-20 deqe, 5 deq, 5 dəq, 5 deyqa, 5deq, 5dq, 3hz, 3 hz, seo 550 deo 232, seo 550, deo 232, 0 24 basla, 0 24 baslamaq, 0 24 başla, 0 24 başlamaq, 1 deqiqe, 12 deqiqe, 12 dəq, 12 deq, 8 deqiqe, 8 dəqiqə, 15 deqiqe, 15 deqqiqe, 15 dəqqiqe, 15 dəq, 3 deqiqe, 2 zona 3 deqiqe, 2 zona, mualiceden once 1 stekan su, müalicədən öncə 1 stəkan su, mualiceden once su icilsen, müalicədən öncə su içilsin, su icilsen, su içilsin, 5 deqiqe, 6 deqiqe, 6 dəqiqə, 10 deqiqq, 10 dəqiqə, uzaq mesafeden, uzaq məsafədən, uzaqdan, yaxin, yaxın, once 1 stekan su, öncə 1 stəkan su, once 1 stekan, 200-100, 200 100, 90-100 mhz, 90 100 mhz, orta tezlikle, orta tezlikli, orta tezliklə, proseduradan usaq 1 stekan su, proseduradan qabaq 1 stekan su, proseduradan usaq 1 stekan s, mualicede n once su icmek lazimdir, müalicədən öncə su içmək lazımdır, mualiceden once su icmek lazimdir, düz cərəyan 1-3 ma, duz cereyan 1-3 ma, düz cərəyan, duz cereyan, 1-3 ma, 1 3 ma |
| `NO_ADDITIVE` | Plain / no plant or drug additive (typical on inhalation). Not a site. | sade, sadə |
| `APPLICATION_SURFACE` | Front vs back of an already chosen S (or full body). Not extra S codes. | on ve arxa hissesi, on ve arxa hissesine, on ve arxa terefi, on ve arxa, ön və arxa hissəsi, ön və arxa hissəsinə, ön və arxa, arxa ve on, on arxa, arxa on, on ve arxasi, ön və arxasi, ön hissəsi, on hissesi, ön və arxaə, yan hissəsi, yan hissesi, rxa, ön və rxa, ön v arxa, arxas, arxa, arxası, arxasi, yuxari hissə, yuxarı hissə, yuxari hissəsi, yuxarı hissəsi, aşagi hissəsi, aşağı hissəsi, aşagi hissə, aşağı hissə, ön hissəsinə, on hissesine, aşagi hissəsinə, aşağı hissəsinə, asagi hissesine, arxasina, arxasına, ön, on, yan tərəf, yan teref, yan tərəfləri, yan terefleri, ardina, ardına |
| `DAY_BLOCK` | N days on site A then N days on site B (paraffin / darsonval). Distinct from növbəli (same slot) and from naftalan BATH_SEQUENCE. | 3 gun, 3 gün, 5 gun, 5 gün, günaşiri, gunasiri, 5 gunden bir, bir günnən bir, 5 gun ardindan, 5 gün ardından, ardindan, axir 4 gun yalniz, axir 4 gün yalniz, bir gunden bir, 1 cib gun, 1 cib gün, günaşir, sonraki günlər, sonraki gunler, sonraki gün, 1 ci, 1-ci, 1ci, 1-ci gun, 1-ci gün, 1 ci gun, 1 ci gün, 5 gunden sonra, 5 gündən sonra, birinci gunu, birinci gün, birinci gun, gwn |
| `BATH_SEQUENCE` | Day-1 sitz then full (naftalan). Two S over time, not one zone. | 1 ci oturaq son tam, 1 ci otraq son tam, 1 ci gün oturaq sonra tam, 1 ci gun oturaq sonra tam, 1 ci dün oturaq sonra tam, 1 ci dun oturaq sonra tam, 1 ci dün oturaq sonr4a tam, 1ci oturaq son tam, 1 ci oturaq con tam, 1ci oturaq con tam, 1 cioturaq con tam, 1 ci vanna oturaq son tam, 1ci gün oturaq sonra tam, 2 oturaq son tam, 1 ciotraq son tam, 1 cioturaq son tam, 1 oturaq son tam, 1 cib gün oturaq sonra tam, 1 ci oturaq so tam, 1 ci gün oturaq sonraki gün tam, 1-ci gün oturaq sonraki gün tam, 1 ci gün oturaq sonraki günlər tam, 1 ci otraq con tam, birinci gün oturaq sonra tam, son tam, sonra tam |
| `SUBSTANCE_OR_ADDITIVE` | Drug / plant / nicotine — electrophoresis, inhalation, UFF. Not anatomy. | bitkilərlə, otlar, bitkilerle, bitkiler, bitkilrlə, bitkilrle, coban yastigi, çoban yastığı, nikatinle, nikotinlə, nikarinle, nikatin, nikatin kislata ile, nikatin kislata, kali yodla, kaliyod, kyodla, ky-la, ky la, ky, kalsiilə, kalsiiləe, kalsi ilə, kalsilə, kalsiile, kalsi, calsi, x kalsi, novakainlə, novokoinle, novakoinle, navakainle, navakain, navakayinla, navakayin, karipazimlə, karipazimle, karipazinle, karpazinlə, karipazin, karirazim, karirazimlə, karirazimle, oz mazi ile, oz mazi, naft, nftal, dimeksid ile, dimeksid ilə, dimeksidiki, dimeksid, dimeksid iile, hidrokortizonla, hidrokartizonla, qidrokartizonla, qidrokartizonle, gidrokartizonla, karipazim, novakayinlə, novokain ilə, öz dərmani ilə, oz dermani ile, oz mazil ile, öz mazı ilə, mg ile, maqniy ilə, maqni sulfatla, maqnezi sulfatla, maqnezi ilə, maqneziile, eufillin, novakainləə, karpazimle, jmaqnezi sulfatla, karipazlmle, karpazim, ozunun mazi ile, özünün mazı ilə, kariipazimlə, mazi ile, maz ilə, mg-le, mg le |
| `SMEAR` | Naftalan smear (surtulsun) — remaining tokens are smear sites, not fill line | surtulsun, yaxmaq, qalan yerlərə yaxmaq, qalan yerlere yaxmaq, temizlenmi, təmizlənməsi |
| `EXTRA_OIL` | UFF / naftalan: extra oil (bol yağla). Consumable note, not a site. | yagi bol olsun, yaği bol olsun, bol yagla, bol yağla, bol yağ, naftalan yagi ile, naftalan yağı ilə, naftalanla, naf, naftalanan, naftalan yagiyla, naftalan yağıyla, naftalan yagi, yaqlar, yağlar |
| `INTENSITY` | Massage intensity (Massaj 15 yungul = light; zəif = weak; isti olmasin = not hot) | cox yungul, yungul, zaif, zəif, cox asta, sethi masaj, səthi masaj, siddetini paient hiss edeceyi derecede, siddetini pasient hiss edeceyi derecede, isti olmasin r, isti olmasin, isdi olmasin, isti olmasın, asagi intensivlik, aşağı intensivlik, asaqi intensiv, orta intensvlik, orta intensivlik, isdi proqram olmasin, isti proqram olmasın, biraz daha cox, biraz daha çox |
| `HOLD_OR_STOP` | Stop / withhold the application. Order action, not anatomy. | dayandirilsin, omaya olmaz, ombaya olmaz, olunmasin, olunmasın, hecbir basqi olmasin, heçbir basqı olmasın, basqi olmasin, basqı olmasın |
| `PROCEDURE_NAME_BLEED` | Procedure title written into nahiye (e.g. shockwave). Not a site. | zerbe dalga, zərbə dalğa, zerbe dalga terapiya, turunda, trunda, trficiskiy yazva, tropiceskiy yazva, tropiçeskaya yazva, tropik yazva, tampon, parafi evezine, parafin əvəzinə, fonofarez, fonoforez, ultrafonofarez, ultrafonoforez |
| `SPINE_LEVEL` | Vertebral qualifier on an S (L4–L5 ≠ Amplipuls IV). Not a new S. | l4 l5, l1 l5, l4l5 s1, l4 l5 s1, l4l5, c3 c4 c5, c4 c5, c5 c6, c4 c6 c7, l1 l2, l3 l4, l1 l3 l4, c4 c5 l1 l3 l4, l1, l2, l3, l4, l5, c3, c4, c5, c6, c7 |
| `APPLICATION_CUT` | Legacy peloid clothing phrases. Canon: these alias foot/hand S; matcher still strips then implies ZONE-FOOT-LEG / ZONE-HAND-FOREARM. | corabşəkilli, corabşekilli, corabşəklli, corabseklli, corabşəkili, corab sekil, corab sekilli, corabsekil, corab nahiyesine, corabnahiyesine, əlcək, elcek, перчатки, носки |

## Resource occupancy (planning, not schema)

Status: **planning-not-schema**. Electro rooms: 7, 8, 10, 11, 12, 13. US rooms: 15, 16, 17. Not in ERA: 14.

| Unit | Model | Rooms | Outputs | Paws/out | 2-pad | 4-pad | Parallel |
|------|-------|-------|---------|----------|-------|-------|----------|
| `BTL-4000-7-8` | BTL 4000 | 7, 8 | 2 | 2 | yes | no | Any electro procedures on both outputs (same or different). |
| `BTL-4000-10-11` | BTL 4000 | 10, 11 | 2 | 2 | yes | no | Any electro procedures on both outputs (same or different). |
| `UNISTIM-5S-12` | UNISTIM 5S | 12 | 1 | 4 | yes | yes | One patient. |
| `BTL-4825S-13` | BTL 4825S Premium | 13 | 1 | 4 | yes | yes | One patient. |

- **BTL 4000** (7+8): One unit between 7 and 8: E1→7 (2 paws), E2→8 (2 paws).
- **BTL 4000** (10+11): One unit between 10 and 11: E1→10 (2 paws), E2→11 (2 paws).
- **UNISTIM 5S** (12): Cabin 12 only: 1 output × 4 paws. Also a 2-pad resource (2 of 4).
- **BTL 4825S Premium** (13): Cabin 13 only: 1 output × 4 paws. Also a 2-pad resource (2 of 4). US on this box not used.

2-pad rooms: 7, 8, 10, 11, 12, 13. 4-pad capability: 12, 13.

FIFO only (placeConfirmedProcedures). Do not hold 12/13 for later 4-pad. 2-pad may take any free electro couch including 12/13.

2 li → any electro couch (12/13 as 2 of 4 paws). 4 lü / 4 basliqli / 4-pole IFC → 12 or 13 when free (capability, not priority). Patient in 7 cannot take both BTL 4000 outputs (second pair is in 8).

One electro nurse covers couches 7, 8, 10–13 (staff lock, not a device lock).

Four apparatuses, six couches: two BTL 4000 (7∥8 and 10∥11), UNISTIM 5S (12), BTL 4825S Premium (13). Closed 2026-08-26.

BTL 4000: any electro procedures in parallel on both outputs (same or different). 12/13 are 2-pad and 4-pad. FIFO: do not hold 12/13 for 4 lü. 4-pad lands on 12/13 only when free. US/UFF stays 15–17; US on 4825S not used. Cabin 7 does not block 8 (same for 10/11).

Keep separate ProcedureTypes (SMT, TENS, Kotz, interference, electrophoresis, UFF gel, UFF oil) sharing resources so TTK/BOM stays per type. UI may group under электротерапия.

#40 LOCATION pool for Amplipuls/Elektroforez is still 7–13. FIFO uses that pool for 2-pad. Four-pad is a capability filter on 12/13 when free, not a second #25 SKU and not a hold.

## Multi-site WO lines

Match S **after** stripping order-field tokens. One WO string → several S chips:

| WO (normalized) | S chips | Flags |
|-----------------|---------|-------|
| kurek boyun ciyinlere ve qollara nobeli | `ZONE-COLLAR` + `ZONE-UPPER-LIMB` | SEQUENCE_ALTERNATING |
| onurga boyu ayaqlar növbəli | `ZONE-SPINE-FULL` + `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| boyun çiyin bel oma növbəli | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | SEQUENCE_ALTERNATING |
| 1 ci oturaq son tam | `ZONE-SITZ` + `ZONE-FULL-BODY` | BATH_SEQUENCE |
| beloma nahiyesine 4 cu rej | `ZONE-LUMBOSACRAL` | AMPLIPULS_WORK_KIND |
| baş boyun | `ZONE-HEAD` + `ZONE-COLLAR` | — |
| baş boyun çiyinlər | `ZONE-HEAD` + `ZONE-COLLAR` | — |
| boyun basin tuklu nahiyesine | `ZONE-COLLAR` + `ZONE-SCALP` | — |
| qarin ayaqlar | `ZONE-ABDOMEN` + `ZONE-LOWER-LIMB` | — |
| bel oma ayaqlar növbəli | `ZONE-LUMBOSACRAL` + `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| büzdüm bel oma tenslə | `ZONE-COCCYX` + `ZONE-LUMBOSACRAL` | DEVICE_PROGRAM |
| əllər corabşəkilli növbəli | `ZONE-HAND-FOREARM` + `ZONE-FOOT-LEG` | SEQUENCE_ALTERNATING, APPLICATION_CUT |
| BOYUN BEL | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | — |
| ayaqlara qarina | `ZONE-LOWER-LIMB` + `ZONE-ABDOMEN` | — |
| qollar ve beden | `ZONE-UPPER-LIMB` + `ZONE-FULL-BODY` | — |
| bədənin ön və arxa hissəsi növbəli | `ZONE-FULL-BODY` | SEQUENCE_ALTERNATING |
| tan beden | `ZONE-FULL-BODY` | — |
| 4kamerali | `ZONE-FOUR-CHAMBER` | — |
| l4 l5 bel fəqərələri dizlər 4lü kali yodla | `ZONE-LUMBOSACRAL` + `ZONE-KNEE` | ELECTRODE_COUNT, SUBSTANCE_OR_ADDITIVE, SPINE_LEVEL |
| əl və ayaq barmaqlari art pr ilə növbəli | `ZONE-HAND-FOREARM` + `ZONE-FOOT-LEG` | DEVICE_PROGRAM, SEQUENCE_ALTERNATING |
| bədənin ön və arxa hissəsinə növbəli | `ZONE-FULL-BODY` | SEQUENCE_ALTERNATING |
| 5 dəq arxa və 5 dəq ön bədən | `ZONE-FULL-BODY` | DEVICE_PARAMS, APPLICATION_SURFACE |
| ön 5 dəq arxa 5 dəq bədən | `ZONE-FULL-BODY` | DEVICE_PARAMS, APPLICATION_SURFACE |
| 5 dəq ön və 5 dəq arxa bədən | `ZONE-FULL-BODY` | DEVICE_PARAMS, APPLICATION_SURFACE |
| qarinin yan tərəfləri və süd vəzinin altina | `ZONE-ABDOMEN` + `ZONE-CHEST` | — |
| 5 dəq ön 5 dəq arxa bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq ön və 5dəq arxa bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| bədən və qollar 5 dəq ön 5 dəq arxa | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq ön 5dəq arxa bədən və qollar | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE |
| baş boyun 5 gun ardindan eyaqlar 5 gun | `ZONE-HEAD` + `ZONE-COLLAR` + `ZONE-LOWER-LIMB` | DAY_BLOCK |
| ayaqlaradizlərə | `ZONE-LOWER-LIMB` + `ZONE-KNEE` | — |
| quadriseps ve biceps ezelelerine 4 basliqli | `ZONE-HIP-GLUTEAL` | ELECTRODE_COUNT |
| femur quadriseps ve hamstring ön və arxa tərəf | `ZONE-HIP-GLUTEAL` | APPLICATION_SURFACE |
| boyuna burun nahiyəsinə | `ZONE-COLLAR` + `ZONE-FACE` | — |
| bədəənin ön vəv arxa hissəsi növbəli | `ZONE-FULL-BODY` | SEQUENCE_ALTERNATING, APPLICATION_SURFACE |
| dizştopuq | `ZONE-KNEE` + `ZONE-ANKLE` | — |
| diz stopuq | `ZONE-KNEE` + `ZONE-ANKLE` | — |
| kurek ne sine | `ZONE-BACK` + `ZONE-CHEST` | — |
| kürək və sinə | `ZONE-BACK` + `ZONE-CHEST` | — |
| iyin boyuk kurem novbəli | `ZONE-SHOULDER` + `ZONE-COLLAR` + `ZONE-BACK` | SEQUENCE_ALTERNATING |
| ciyin boyuk kurem novbəli | `ZONE-SHOULDER` + `ZONE-COLLAR` + `ZONE-BACK` | SEQUENCE_ALTERNATING |
| buruna naftalanla | `ZONE-FACE` | EXTRA_OIL |
| ayaqlar nov | `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| bel ayaq novbeli | `ZONE-LUMBOSACRAL` + `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| bel ayaq növbəli | `ZONE-LUMBOSACRAL` + `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| bədənin ön hissəsinə | `ZONE-FULL-BODY` | APPLICATION_SURFACE |
| bədənin ön v arxa hissələri | `ZONE-FULL-BODY` | APPLICATION_SURFACE |
| beloma nahiyesine k navakainle | `ZONE-LUMBOSACRAL` | SUBSTANCE_OR_ADDITIVE |
| 4 basliql hem servikal hem lumbar bolgeye eyni enda karipazin | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | ELECTRODE_COUNT, SEQUENCE_SIMULTANEOUS, SUBSTANCE_OR_ADDITIVE |
| 4 basliqli iki basligi boyun dimeksidiki basligi bel oma | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | ELECTRODE_COUNT, SUBSTANCE_OR_ADDITIVE |
| 5dəq ön və 5dəq arxa bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5dəq ön və 5 dəq arxa bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq ön 5 dəq arxa bədən və qollar eyni vaxti | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq bədən ön və 5 dəq arxa bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq arxa 5 dəq ön bədən və qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | DEVICE_PARAMS, APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| 5 dəq arxa 5 dəq ön | `ZONE-FULL-BODY` | DEVICE_PARAMS, APPLICATION_SURFACE |
| 15 deqiqe bel 15 deqiqe eyaq | `ZONE-LUMBOSACRAL` + `ZONE-LOWER-LIMB` | DEVICE_PARAMS |
| topuq lara trficiskiy yazva | `ZONE-ANKLE` | PROCEDURE_NAME_BLEED |
| ayaqlar q1arin | `ZONE-LOWER-LIMB` + `ZONE-ABDOMEN` | — |
| bədənin arxa hissəsi | `ZONE-FULL-BODY` | APPLICATION_SURFACE |
| dos qefesine qeder omaya olmaz | `ZONE-CHEST` | HOLD_OR_STOP |
| doş qefesine qeder omaya olmaz | `ZONE-CHEST` | HOLD_OR_STOP |
| döş qəfəsinə qədər ombaya olmaz | `ZONE-CHEST` | HOLD_OR_STOP |
| kürəyin yuxari hissəsi | `ZONE-BACK` | APPLICATION_SURFACE |
| onurga boyu art | `ZONE-SPINE-FULL` | DEVICE_PROGRAM |
| beloma nahiyesine 4 cu re ve kurek boyuna nobeli j | `ZONE-LUMBOSACRAL` + `ZONE-BACK` + `ZONE-COLLAR` | AMPLIPULS_WORK_KIND, SEQUENCE_ALTERNATING |
| ciyinşkürək | `ZONE-SHOULDER` + `ZONE-BACK` | — |
| ciyin kürək | `ZONE-SHOULDER` + `ZONE-BACK` | — |
| diz topuq | `ZONE-KNEE` + `ZONE-ANKLE` | — |
| basin arxasina | `ZONE-HEAD` | APPLICATION_SURFACE |
| onurga boyu ayaqlar nov | `ZONE-SPINE-FULL` + `ZONE-LOWER-LIMB` | SEQUENCE_ALTERNATING |
| dizler navakayin 5 gunden sonra boyun ardina | `ZONE-KNEE` + `ZONE-COLLAR` | SUBSTANCE_OR_ADDITIVE, DAY_BLOCK, APPLICATION_SURFACE |
| so baldir | `ZONE-FOOT-LEG` | LATERALITY |
| ön bədən | `ZONE-FULL-BODY` | APPLICATION_SURFACE |
| ekstremite | `ZONE-UPPER-LIMB` + `ZONE-LOWER-LIMB` | — |
| topulara olunmasin | `ZONE-ANKLE` | HOLD_OR_STOP |
| kurek ayaqlar naftalanan novbəli | `ZONE-BACK` + `ZONE-LOWER-LIMB` | EXTRA_OIL, SEQUENCE_ALTERNATING |
| ön bədən və arxa bədən qollar eyni vaxtda | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | APPLICATION_SURFACE, SEQUENCE_SIMULTANEOUS |
| aciq urek emeliyati olub deye cox yungul masaj urek nahiyesine hecbir basqi olmasin | `ZONE-CHEST` | INTENSITY, HOLD_OR_STOP |
| baden gollar on ve arxa telefi | `ZONE-FULL-BODY` + `ZONE-UPPER-LIMB` | APPLICATION_SURFACE |
| belinden eyaqlarinin altina qeder | `ZONE-LOWER-LIMB` + `ZONE-FOOT-LEG` | — |
| enterferensial proqrami ile supraspinatus ve insraspinatus ezelelerinin usdune | `ZONE-SHOULDER` | DEVICE_PROGRAM |
| sadirsek qola | `ZONE-ELBOW` + `ZONE-UPPER-LIMB` | LATERALITY |
| oturaqqursaga kimi | `ZONE-SITZ` + `ZONE-TO-WAIST` | — |
| dizden asagi eyaqlar | `ZONE-FOOT-LEG` | — |
| c4 c5 l1 l3 l4 karipazimlə növbəli | `ZONE-SPINE-FULL` | SPINE_LEVEL, SUBSTANCE_OR_ADDITIVE, SEQUENCE_ALTERNATING |
| c4 c5 l1 l3 l4 | `ZONE-SPINE-FULL` | SPINE_LEVEL |
| boyun yuxari bel | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | — |
| yuxari boyun | `ZONE-COLLAR` | — |
| oturaq qollari daxil | `ZONE-SITZ` + `ZONE-UPPER-LIMB` | — |
| tam onurga qollardan asagi eyni anda | `ZONE-SPINE-FULL` + `ZONE-HAND-FOREARM` | SEQUENCE_SIMULTANEOUS |
| kurekboyun ciyinlere | `ZONE-BACK` + `ZONE-COLLAR` + `ZONE-SHOULDER` | — |
| kurekboyun | `ZONE-BACK` + `ZONE-COLLAR` | — |
| sol qolu el biləyi təmizlənmi s naftalan yagi | `ZONE-UPPER-LIMB` + `ZONE-WRIST` | LATERALITY, SMEAR, EXTRA_OIL |
| trapez ve lotissimus dorsi ezeleler enterferensial proqramo 90-100 mhz | `ZONE-COLLAR` + `ZONE-BACK` | DEVICE_PROGRAM, DEVICE_PARAMS |
| varatnik bel oma kali yodla növbəlic3şc4 l3 l4 | `ZONE-COLLAR` + `ZONE-LUMBOSACRAL` | SUBSTANCE_OR_ADDITIVE, SEQUENCE_ALTERNATING, SPINE_LEVEL |
| eller corab sekil ayaqar varatnik novbe | `ZONE-HAND-FOREARM` + `ZONE-FOOT-LEG` + `ZONE-COLLAR` | SEQUENCE_ALTERNATING |
| her iki dizlere ve ayaq pen artroz rej cesine nobeli | `ZONE-KNEE` + `ZONE-FOOT-LEG` | DEVICE_PROGRAM, LATERALITY, SEQUENCE_ALTERNATING |
| her iki bud canaq nahiyesin ve dizlere nobeli e | `ZONE-HIP-GLUTEAL` + `ZONE-KNEE` | LATERALITY, SEQUENCE_ALTERNATING |
| kürək və boynuna | `ZONE-BACK` + `ZONE-COLLAR` | — |
| kurek cuyinlere | `ZONE-BACK` + `ZONE-SHOULDER` | — |
