-- Nafta pilot: NAS analytical subaccounts for hotel day-document revenue (601.BB.CCC) and city tax (521.01).
-- Same row shape as AccountsService.createNasSubaccount: parent type, NAS book, AZN, dot-separated code.
-- ADR: docs/adr/hotel-revenue-code-resolution.md
-- Run once: psql -v ON_ERROR_STOP=1 -d era_finance -f nafta-revenue-subaccounts-2026-10.sql
-- Safe to re-run: existing codes are skipped.
\set org '6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b'

BEGIN;

CREATE TEMP TABLE nafta_sub (
  ord int, parent_code text, code text, name_az text, name_ru text, name_en text
) ON COMMIT DROP;

INSERT INTO nafta_sub VALUES
  (1,'601','601.01','Otel gəliri','Выручка отеля','Hotel revenue'),
  (1,'601','601.02','Klinika gəliri','Выручка клиники','Clinic revenue'),
  (1,'601','601.03','Mağaza gəliri','Выручка магазина','Shop revenue'),
  (1,'601','601.04','F&B gəliri','Выручка F&B','F&B revenue'),
  (1,'521','521.01','Turist rüsumu','Туристический сбор','City tax'),
  (2,'601.01','601.01.001','Otaq','Номер','Room'),
  (2,'601.01','601.01.002','Qiymətə daxil qidalanma','Пансион в цене номера','Board in rate'),
  (2,'601.01','601.01.003','Tibbi paket','Медпакет','Medical package'),
  (2,'601.01','601.01.004','Qiymətə daxil müalicə','Лечение в тарифе','Treatment in rate'),
  (2,'601.01','601.01.005','Qiymət düzəlişi','Корректировка цены','Rate adjustment'),
  (2,'601.01','601.01.006','Erkən giriş','Ранний заезд','Early check-in'),
  (2,'601.01','601.01.007','Gec çıxış','Поздний выезд','Late check-out'),
  (2,'601.01','601.01.008','Əlavə çarpayı','Дополнительная кровать','Extra bed'),
  (2,'601.01','601.01.009','Minibar','Мини-бар','Minibar'),
  (2,'601.01','601.01.010','Camaşırxana','Прачечная','Laundry'),
  (2,'601.01','601.01.011','Transfer','Трансфер','Transfer'),
  (2,'601.01','601.01.012','Taksi','Такси','Taxi'),
  (2,'601.01','601.01.013','Ekskursiyalar','Экскурсии','Tours'),
  (2,'601.01','601.01.014','Banket','Банкет','Banquet'),
  (2,'601.01','601.01.015','Ləğv və gəlməmə cərimələri','Штрафы за отмену и неявку','Cancellation and no-show fees'),
  (2,'601.01','601.01.016','Zərər və itki','Порча и утеря имущества','Damage and loss'),
  (2,'601.01','601.01.017','Digər xidmətlər','Прочие услуги','Other services'),
  (2,'601.01','601.01.018','Konsyerj vasitəsilə yemək','Еда через консьержа','Concierge food'),
  (2,'601.01','601.01.099','Otel endirimi','Скидка отеля','Hotel discount'),
  (2,'601.02','601.02.001','Prosedurlar','Процедуры','Procedures'),
  (2,'601.02','601.02.002','Həkim qəbulu','Приём врача','Doctor consultation'),
  (2,'601.02','601.02.003','Diaqnostika','Диагностика','Diagnostics'),
  (2,'601.02','601.02.004','Laboratoriya','Анализы','Laboratory'),
  (2,'601.02','601.02.005','Stasionar','Стационар','Inpatient bed-day'),
  (2,'601.02','601.02.006','Dərmanlar','Лекарства','Medicines'),
  (2,'601.02','601.02.007','Sanatoriya proqramı','Санаторная программа','Sanatorium program'),
  (2,'601.02','601.02.099','Klinika endirimi','Скидка клиники','Clinic discount'),
  (2,'601.03','601.03.001','Mağaza malları','Товары магазина','Shop goods'),
  (2,'601.03','601.03.099','Mağaza endirimi','Скидка магазина','Shop discount'),
  (2,'601.04','601.04.001','Yemək','Еда','Food'),
  (2,'601.04','601.04.002','İçkilər','Напитки','Beverages'),
  (2,'601.04','601.04.003','Spirtli içkilər','Алкоголь','Alcohol'),
  (2,'601.04','601.04.004','Tütün','Табак','Tobacco'),
  (2,'601.04','601.04.005','Zal icarəsi','Аренда зала','Hall rent'),
  (2,'601.04','601.04.006','Əyləncə','Развлечения','Entertainment'),
  (2,'601.04','601.04.099','F&B endirimi','Скидка F&B','F&B discount');

-- Level 1 (groups and 521.01) first, then leaves under the groups.
INSERT INTO accounts (organization_id, accounting_book_id, ledger_type, code, name_az, name_ru, name_en, type, currency, parent_id, updated_at)
SELECT p.organization_id, p.accounting_book_id, 'NAS', s.code, s.name_az, s.name_ru, s.name_en, p.type, 'AZN', p.id, now()
  FROM nafta_sub s
  JOIN accounts p ON p.organization_id = :'org' AND p.ledger_type = 'NAS' AND p.code = s.parent_code AND p.deleted_at IS NULL
 WHERE s.ord = 1
   AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.organization_id = :'org' AND x.ledger_type = 'NAS'
                     AND x.accounting_book_id = p.accounting_book_id AND x.code = s.code);

INSERT INTO accounts (organization_id, accounting_book_id, ledger_type, code, name_az, name_ru, name_en, type, currency, parent_id, updated_at)
SELECT p.organization_id, p.accounting_book_id, 'NAS', s.code, s.name_az, s.name_ru, s.name_en, p.type, 'AZN', p.id, now()
  FROM nafta_sub s
  JOIN accounts p ON p.organization_id = :'org' AND p.ledger_type = 'NAS' AND p.code = s.parent_code AND p.deleted_at IS NULL
 WHERE s.ord = 2
   AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.organization_id = :'org' AND x.ledger_type = 'NAS'
                     AND x.accounting_book_id = p.accounting_book_id AND x.code = s.code);

DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM nafta_sub s
   WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.organization_id = '6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b'
                       AND a.ledger_type = 'NAS' AND a.code = s.code AND a.deleted_at IS NULL);
  IF missing > 0 THEN RAISE EXCEPTION 'NAS subaccounts missing after insert: %', missing; END IF;
END $$;

SELECT a.code, a.type, a.name_ru, p.code AS parent
  FROM accounts a JOIN accounts p ON p.id = a.parent_id
 WHERE a.organization_id = :'org' AND a.ledger_type = 'NAS' AND a.code IN (SELECT code FROM nafta_sub)
 ORDER BY a.code;

COMMIT;
