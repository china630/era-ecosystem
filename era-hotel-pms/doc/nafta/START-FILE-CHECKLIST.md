# Nafta — единый чеклист файлов на старт контура

Срез: **2026-08-25** (cutover). Сырьё: `D:\ERA-BACKUP\NAFTA-START\`. Книги wizard: `D:\ERA-BACKUP\NAFTA-ERA-READY\`.  
**Мастер Apply (номера 01–47):** `D:\ERA-BACKUP\NAFTA-ERA-READY\IMPORT-CHECKLIST.md`  
Код имён: `era-clinic/scripts/nafta-cutover/pack-layout.cjs`

**2026-08-30:** сквозная нумерация HR→hotel→clinic→FnB→retail→1C. Старые EW 01–20 / clinic 21–40 / HR 37 / 1C 40–53 **не** использовать.

```
D:\ERA-BACKUP\
  NAFTA-START\           сырьё (не грузить wizard’ом как есть)
    hr/                  02-Employees + Ştat (имя AZ)
    August/              EW 2026-08-30 drop (guest cards, FO, folio, notes, agencies)
    hotel/               03–15 + folio archives; _not-ready/
    clinic/dump|catalogs WebOnly (не нумеровать dump)
    fnb/                 30–32
    retail/              33
    1c/                  34–47
  NAFTA-ERA-READY\       wizard Apply
    IMPORT-CHECKLIST.md  мастер
    hr/01–02  hotel/03–15  clinic/16–29  fnb/30–32  retail/33  1c/34–47
```

Легенда: `[x]` файл на диске · `[ ]` просить.  
Колонка **Файл** — путь от `NAFTA-START\` (сырьё). Готовый импорт: тот же номер в `NAFTA-ERA-READY\` (`hotel/`, `clinic/`, `hr/`, `1c/`).  
Колонка **Бух** — что сказать бухгалтеру (пусто = не просить).

Инвентарь: [START-DATA-INVENTORY.md](./START-DATA-INVENTORY.md).

---

## A. Hotel — `hotel\` → `era-hotel-pms` `/admin/import`

| # | Есть | Файл | Куда | Бух |
|---|:---:|------|------|-----|
| 01 | [x] | `hotel/01-Revenue-Codes.xlsx` | Hotel wizard `revenue-codes` | — |
| 02 | [x] | `hotel/02-Bed-Types.xlsx` | Hotel wizard | — |
| 03 | [x] | `hotel/03-Room-Views.xlsx` | Hotel wizard | — |
| 04 | [x] | `hotel/04-Room-Types.xlsx` | Hotel wizard | — |
| 05 | [x] | `hotel/05-Rooms.xlsx` | Hotel wizard | Stripped to `Room No` / `Room Type` / `Floor` / `Bed Type`. Do not re-add EW `Max Bed` (zeros) or `Room State`. |
| 06 | [x] | `hotel/06-Rate-Codes.xlsx` | Hotel wizard | — |
| 07 | [x] | `hotel/07-Travel-Agencies.xlsx` | Hotel wizard | — |
| 08 | [x] | `hotel/08-Product-Cards.xlsx` (+ `08-Product-Group-List.xlsx`) — EW **2026-08-21** | Hotel wizard SELLABLE | — |
| 09 | [x] | `hotel/09-Stock-Cards.xlsx` — EW Ürün Tanımları **2026-08-21** | Hotel wizard STOCK | — |
| 10 | [x] | `hotel/10-Guest-Cards.merged.xlsx` (7 723 EW + 407 FO-only `wo:fo:*`) | Hotel wizard `guests` + MDM | FO dump **2026-08-30**: `hotel/dump/guest-cards.json` **1608**, passport+DOB on all |
| 11 | [x] | `hotel/11-Reservations.merged.xlsx` (6 117) | Hotel wizard, 2026+ / InHouse / future | — |
| 12 | [x] | `hotel/12-Folio-Transactions.hotel.xlsx` (wizard) · archive `12-Folio-Transactions.merged.xlsx` (95 793) | Hotel wizard `folios`. Только брони из `#11`; без `TIBB AMBULATOR` / `999 FB` / CASH/DEBITOR. | — |
| 13 | [x] | `hotel/13-Package-Prices-2026.csv` | Hotel rate plans + Clinic `ProgramTemplate` | — |
| 14 | [x] | `hotel/14-BAR-Derived-2026.csv` (+ `.md`) | Hotel BAR (учётная лестница) | — |
| 15 | [x] | `hotel/15-Hizmet-Tanimlari.xlsx` — EW **2026-08-21** (Hizmet Tanımları; не путать с WO #25) | Hotel `SPA MEDIKAL` extra; сверка имён с #25 | — |
| 16 | [x] | `hotel/16-FnB-Transactions.merged.xlsx` (old 22 219 overwritten) | Сверка F&B, **не** меню | **2026-08-31:** raw 2026 cheques in `START/fnb/_source/ew-2026-999-fb` (5 880, guest 999 FB until 2026-07-03) + `ew-2026-xudmani` (1 582; CASH → READY `#32`, named in-house → hotel `#13`). READY `#32` = **8 559** |
| 17 | [x] | `hotel/17-ProFolio-Transactions.xlsx` | Только сверка ROOM, не грузить как folio | — |
| 18 | [x] | `hotel/18-Contract-Details.xlsx` | Справка | — |
| 19 | [x] | `hotel/19-Agency-Statement.xlsx` (stale 15.06) · **fresh** READY `hotel/15-Agency-Statement.xlsx` (2026-08-31) | **Hotel** wizard `agency-statement` — FO city ledger remaining. **Not** 1C. 1C AR/AP stays `#45` ASK | Свежая ведомость EW — в отель; развёрнутая ДЗ/КЗ — из 1С (#45) |
| 20 | [x] | `hotel/20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx` | **Не грузить** | План счетов из 1С (#48) |

---

## B. Clinic — `clinic\` → `era-clinic`

### B1. Живой дамп API (`clinic/dump\`) — обновлено **2026-08-30**

| # | Есть | Файл | READY | Строк | Бух |
|---|:---:|------|-------|------:|-----|
| 21 | [x] | `clinic/dump/cards/` + `bulk/patients.json` | READY `#24` | **1722** | — |
| 22 | [x] | `clinic/dump/bulk/examination-forms.json` | READY `#29` | **431** USG forms | — |
| 23 | [x] | `clinic/dump/calendar/reservations-all.json` (62 166) | READY `#26` | max **2026-09-10** | Ops **25–30.08**; WO слотов на 30 нет |
| 24 | [x] | `clinic/dump/files/lab/` + `bulk/lab-results.json` | READY `#27`/`#28` | **2369** meta / **2200** Word | ~169 без Word — не импортируем |

### B2. Справочники и curated pack

| # | Есть | Файл (START) | READY | Строк | Бух |
|---|:---:|--------------|-------|------:|-----|
| 25 | [x] | **`clinic/reports/01-procedures.xlsx`** (SSOT) · ref WO `dump/catalogs/treatments.json` (154) | `25-Treatments.xlsx` | **80** | Кураторский каталог; не весь WO |
| 26 | [x] | SSOT кабинеты + история календаря | `26-Rooms.xlsx` | **63** | Kabina 14 — для истории #23 |
| 27 | [x] | `clinic/reports/27-practitioners-roster.json` + HR | `27-Doctors.xlsx` | **8** | — |
| 28 | [x] | `clinic/catalogs/28-Shifts.csv` + dump | — | ref | **Не** в ERA-READY |
| 29 | [x] | `dump/catalogs/analyses.json` → map | `29-Analyses.xlsx` | **58** | — |
| 30 | [x] | `clinic/catalogs/30-Laboratory.xlsx` | — | ref | **Не** в ERA-READY |
| 31 | [x] | dump forms (USG) | `31-Diagnostics.xlsx` | **370** | — |
| 32 | [x] | dump forms | `32-Diagnoses.xlsx` | **372** | — |
| 33–36 | [x] | `clinic/catalogs/33–36` | copy | ref | Ref only |
| 38 | [x] | calendar flatten | `38-quotas.xlsx` | **8778** | 97.8% match #25 |
| 39 | [x] | Word lab flatten | `39-lab-results.xlsx` | **22620** | — |
| **40** | [x] | из `01-procedures.xlsx` (кабинеты) | `40-Procedure-Requirements.xlsx` | **126** | После #25+#26; **новое** планирование |

Зеркало curated: `clinic/reports/era-import/` (#25, #26, #40 + `manifest.json`).

---

## C. Кадры — `hr\` → Orchestrator Workforce

| # | Есть | Файл | Куда | Бух |
|---|:---:|------|------|-----|
| 37 | [x] | `hr/37-Employees.xlsx` + `hr/Əməkdaşların yenilənmiş siyahı Nafta 28.08.2026.xlsx` (FİN + Cins K/Q + DOB + hire + şöbə + vəzifə + əsas/əlavə) | CP: сначала `org-structure.xlsx`, затем roster. Пустые satellites = штат без логина. ƏLAVƏ = вторая должность, без seat. Даты: сериал Excel и `ДД.ММ.ГГГГ` → строки `YYYY-MM-DD` (не ISO с часовым поясом). | Табель / МОЛ / email — только если без них не заведём сотрудника в CP. **Ştat vahidləri** → READY `hr/org-structure.xlsx`. |

---

## D. Просить у бухгалтера — положить в `1c\`, отметить `[x]`

Дата среза: **календарный день cutover (hour X)**, валюта **AZN**, организация **Nafta Sanatorium MMC**.

| # | Есть | Файл (как назвать) | Куда | Бух — точная формулировка |
|---|:---:|--------------------|------|---------------------------|
| 40 | [ ] | `1c/40-1C-FnB-Nomenclature.xlsx` | FnB | **Номенклатура F&B.** Excel: код, полное наименование, вид (сырьё / п/ф / блюдо / напиток), ед. изм. (кг, л, шт.), фасовка, ставка НДС, базовая цена закупки. Все позиции кухни, бара, заготовочного. Без основных средств и белья. |
| 41 | [ ] | `1c/41-1C-FnB-Menu-Prices.xlsx` | FnB | **Действующий прейскурант / меню.** Excel по точкам: Ресторан, лобби-бар, room service (если отдельно). Колонки: код номенклатуры (как в #40), название, точка продаж, розничная цена AZN, НДС, дата начала действия. Только продаваемые блюда и напитки. |
| 42 | [ ] | `1c/42-1C-FnB-Recipes-TTK.xlsx` | FnB | **ТТК / калькуляционные карты.** На каждое блюдо и п/ф: состав (код сырья из #40), норма брутто, норма нетто, % холодной/горячей обработки, выход порции, краткая технология. Если в 1С карт нет — написать «нет» и не выдумывать. POS без ТТК открыть можно, себестоимость — нет. |
| 43 | [ ] | `1c/43-1C-FnB-Stock.xlsx` | FnB | **Остатки ТМЦ F&B на дату среза.** Счета 10 / 41 / 43. Разрез: склад (Основной, Кухня, Бар, Заготовка) → код → наименование → ед. изм. → количество → учётная цена → сумма. Без хозсклада и аптеки. Если партионный учёт — серия и срок годности. |
| 44 | [x] | `1c/44-1C-Counterparties.xlsx` (из `Kontragentlər.xlsx`, 2026-08-23) | Finance | Получен справочник контрагентов. Сверить колонки с VOEN / IBAN / договорами; при дырах — дозапросить. |
| 45 | [ ] | `1c/45-1C-AR-AP.xlsx` | Finance | **Развёрнутая ДЗ/КЗ, счета 60, 62, 76.** На дату среза: контрагент → договор → документ расчётов (счёт / накладная / акт, номер и дата) → дебет / кредит / аванс, AZN. Не свёрнутое сальдо по контрагенту. Агентства отеля можно сверить с EW Agency Statement, но источником должна быть 1С. |
| 46 | [ ] | `1c/46-1C-Trial-Balance.xlsx` | Finance | **ОСВ по всем счетам** на дату среза, с субсчетами. Колонки: счёт, субсчёт, наименование, сальдо нач. дебет/кредит, оборот д/к, сальдо кон. д/к. Одна книга, не по журналам. |
| 47 | [ ] | `1c/47-1C-Cash-Banks.xlsx` | Finance | **Остатки денег, счета 50, 51, 57.** По каждой операционной кассе (имя кассы), каждому расчётному счёту (IBAN), эквайринг «в пути». Сумма AZN на дату среза. |
| 48 | [ ] | `1c/48-1C-CoA-Mapping.xlsx` | Finance | **План счетов 1С** (код, имя, тип) — чтобы свести на счета ERA. Не выгрузка EW Chart of Accounts. Можно тем же файлом, что ОСВ, если счета там полные. |
| 49 | [ ] | `1c/49-1C-VAT.xlsx` | Finance | **Ставки / справочник ƏDV (НДС).** Файл `ƏV.xlsx` оказался **ОС**, не НДС — см. #50. НДС отдельно, если нужен. |
| 50 | [x] | `1c/50-1C-Fixed-Assets.xlsx` (из `ƏV.xlsx` / Əsas Vəsait, 2026-08-23; ранее ошибочно как #49 VAT) | Finance | **Основные средства и инвентарь.** Сверить колонки: инв. номер, наименование, дата ввода, стоимость, МОЛ, место. |
| 51 | [ ] | `1c/51-1C-Housekeeping-Stock.xlsx` | Hotel / Finance | **Остатки хозсклада.** Бельё, косметика для номеров, хозинвентарь. Сч. 10, не кухня и не аптека. Разрез: склад → код → наименование → ед. изм. → количество → учётная цена → сумма. |
| 52 | [ ] | `1c/52-1C-Pharmacy-Stock.xlsx` | Retail / Clinic | **Остатки аптеки / медсклада** на дату среза. Сч. 10: код, наименование, ед. изм., количество, учётная цена, сумма, серия и срок годности если есть. Отдельно от F&B (#43) и хозсклада (#51). |
| 53 | [x] | `1c/53-1C-Procedure-Consumables.docx` (из `texniki terkib tibb.docx`, 2026-08-23) | Clinic / Retail | Техсостав медицины (Word, не Excel). Разобрать в нормы «процедура → ТМЦ → кол-во»; Excel-форму чеклиста пока нет. |

---

## E. Не просить — уже есть

| # | Что | Почему |
|---|-----|--------|
| 54 | номерной фонд / тарифы / авансы гостей | Уже есть в hotel #05 #06 #11 #12 |
| 55 | медкаталог / пакеты | Уже есть #13 #15 #25 |
| 56 | список сотрудников | Уже есть #37 |

---

## Текст, который можно отправить бухгалтеру

Скопировать как есть:

```
Нужны выгрузки из 1С Nafta Sanatorium MMC на дату среза [ДАТА CUTOVER], валюта AZN, Excel.

1) Номенклатура F&B — код, название, вид (сырьё/п/ф/блюдо/напиток), ед. изм., фасовка, НДС, цена закупки.
2) Прейскурант меню по точкам (ресторан, лобби-бар, room service): код, название, точка, цена AZN, НДС, дата действия.
3) ТТК / калькуляции блюд и п/ф: состав, брутто, нетто, % обработки, выход. Если карт нет — напишите «нет».
4) Остатки ТМЦ F&B (сч. 10, 41, 43) по складам Кухня / Бар / Основной / Заготовка: код, кол-во, учётная цена, сумма. Кухня отдельно от хозсклада и аптеки.
5) Контрагенты: имя, ВÖЕН, банк/IBAN, тип (поставщик/юрлицо/агент/физлицо), договоры.
6) ДЗ/КЗ сч. 60, 62, 76 развёрнуто: контрагент → договор → документ → сумма долга/аванса.
7) ОСВ по всем счетам с субсчетами на дату среза.
8) Остатки денег сч. 50, 51, 57 по каждой кассе, IBAN и эквайрингу в пути.
9) Основные средства и инвентарь (01, 02, МЦ.04): инв. номер, имя, дата ввода, стоимость, МОЛ, место.
10) Остатки хозсклада: бельё, косметика для номеров, хозинвентарь. Не кухня, не аптека.
11) Остатки аптеки / медсклада: код, кол-во, цена, сумма, серия/срок если есть.
12) Нормы списания на процедуру: процедура → код ТМЦ → количество на 1 сеанс. Если норм нет — «нет».

Не нужно: номерной фонд, тарифы проживания, авансы гостей, каталог медуслуг, пакетные программы, список сотрудников.

Имена файлов (положить в D:\ERA-BACKUP\NAFTA-START\1c\):
40-1C-FnB-Nomenclature.xlsx
41-1C-FnB-Menu-Prices.xlsx
42-1C-FnB-Recipes-TTK.xlsx
43-1C-FnB-Stock.xlsx
44-1C-Counterparties.xlsx
45-1C-AR-AP.xlsx
46-1C-Trial-Balance.xlsx
47-1C-Cash-Banks.xlsx
48-1C-CoA-Mapping.xlsx
50-1C-Fixed-Assets.xlsx
51-1C-Housekeeping-Stock.xlsx
52-1C-Pharmacy-Stock.xlsx
53-1C-Procedure-Consumables.xlsx
```

Положить полученные файлы в `D:\ERA-BACKUP\NAFTA-START\1c\` и отметить `#40–#53` выше.
