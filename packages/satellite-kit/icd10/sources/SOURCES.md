# ICD-10 sources

`data/icd10-catalog.json` is built only from the files below (`node build-icd10-catalog.cjs`;
CI guard: `--check`). Code list and hierarchy come from WHO. Each title column comes only from its
own language source; a missing translation is `null`, never generated or copied from another language.

| Column | Source | File | Licence / status |
|---|---|---|---|
| codes, hierarchy, `titleEn` | WHO ICD-10 2019 (incl. COVID-19 updates), plain-text tabular — <https://icdcdn.who.int/icd10/meta/icd102019enMeta.zip> | `who-2019/icd102019syst_{codes,chapters,groups}.txt` | CC BY-ND 3.0 IGO. Attribution: *International Classification of Diseases Tenth Revision (ICD-10), 2019. Geneva: World Health Organization.* Titles are used verbatim. |
| `titleRu` | Minzdrav RF NSI, OID `1.2.643.5.1.13.13.11.1005` «МКБ-10», version 2.27. Mirror: <https://github.com/ak4nv/mkb10> (`resources/1.2.643.5.1.13.13.11.1005_2.27.csv`); origin <https://nsi.rosminzdrav.ru> | `ru-minzdrav/1.2.643.5.1.13.13.11.1005_2.27.csv` | Official federal reference book (open). Re-verify against the NSI export when nsi.rosminzdrav.ru is reachable. |
| `titleAz` | «Xəstəliklərin və sağlamlıqla bağlı problemlərin beynəlxalq statistik təsnifatı. Onuncu baxış. I cild (I və II hissə)». AR Səhiyyə Nazirliyi İnformatika və Statistika İdarəsi, 2012 (translation of WHO 1992 edition) | `az-xbt10/xbt10-az-2012.json` (extracted; PDFs not committed) | Official AZ edition. Extracted with `tools/pdf-lines.py` + `tools/extract-az.cjs`. |

## Checksums (SHA-256)

Text files were normalised to UTF-8 + LF before commit.

| File | SHA-256 |
|---|---|
| `icd102019enMeta.zip` (as downloaded) | `a9fa787fa79076e199e46ca645bbc076449853e93e62cd3b2050b96dc96bbc1d` |
| `1.2.643.5.1.13.13.11.1005_2.27.csv` (as downloaded) | `3b0a2ff314b3a1e1489338ae9e83c15fbdf4f98250f7b886c27edb60ef507509` |
| `XBT_1_cild_I_hisse.pdf` (I hissə, classes I–XIII, 464 pages) | `9ad4844a1b5fd8e053494bae8c0aed4685c68301b5b13e3185a55a2d3023634c` |
| `676306772-XBT-1-cild-II-hisse.pdf` (II hissə, classes XIV–XXII, 396 pages) | `d8fcc9d683b2a47c405604b6de22de7e4e6d4ab8a64b4a317500f7879567397f` |

## AZ extraction rules

- Titles are the Arial ≥12.5 pt lines of the tabular list (codes and their wrapped continuations);
  inclusion / exclusion notes (Times 11 pt) are not part of the title.
- Fourth-character subdivisions printed once for a range (e.g. «Aşağıdakı dördüncü rəqəmlər E10-E14
  rubrikaları ilə istifadə olunur», K25–K28, N00–N07, O03–O06, V01–V06 …) are applied as
  `<category title>: <subdivision title>` — the same composition WHO uses for these codes in its own
  files (`E10.0` = «Type 1 diabetes mellitus: With coma»). Listed in `xbt10-az-2012.json` → `composed`.
- Only codes that exist in WHO ICD-10 2019 are kept. Codes WHO added after the 1992 base edition
  (e.g. A97, I48.0–I48.4, K64, U07–U85) have no AZ title in the book and stay `null`; D38, D38.0–D38.2
  are missing in the printed book itself.

## Regenerate

```bash
python tools/pdf-lines.py XBT_1_cild_I_hisse.pdf /tmp/az1.jsonl
python tools/pdf-lines.py 676306772-XBT-1-cild-II-hisse.pdf /tmp/az2.jsonl
node tools/extract-az.cjs /tmp/az1.jsonl /tmp/az2.jsonl
node build-icd10-catalog.cjs
```
