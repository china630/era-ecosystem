-- DO NOT RUN. Live revenue codes are on the hotel revenue-code screen.
-- Archive only. Nafta pilot: numeric BOCC revenue codes (B = business line, O = outlet, CC = category).
-- ADR: docs/adr/hotel-revenue-code-resolution.md
\set org '6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b'

BEGIN;

-- Column ships with migration 20261015200000 (idempotent there too).
ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "systemRole" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "RevenueCode_organizationId_systemRole_key"
  ON "RevenueCode"("organizationId", "systemRole");

CREATE TEMP TABLE nafta_codes (
  code text PRIMARY KEY, name_en text, name_ru text, name_az text,
  role text, tax text, gl text, legacy text
) ON COMMIT DROP;

INSERT INTO nafta_codes VALUES
  ('1001','Room','Номер','Otaq','ROOM','18.00','601.01.001','10'),
  ('1002','Board in rate','Пансион в цене номера','Qiymətə daxil qidalanma','BOARD','18.00','601.01.002',NULL),
  ('1003','Medical package','Медпакет','Tibbi paket','PKG','18.00','601.01.003',NULL),
  ('1004','Treatment in rate','Лечение в тарифе','Qiymətə daxil müalicə','TREATMENT','18.00','601.01.004',NULL),
  ('1005','Rate adjustment','Корректировка цены','Qiymət düzəlişi','RATE_ADJ','18.00','601.01.005',NULL),
  ('1006','Early check-in','Ранний заезд','Erkən giriş','EARLY_CI','18.00','601.01.006',NULL),
  ('1007','Late check-out','Поздний выезд','Gec çıxış','LATE_CO','18.00','601.01.007',NULL),
  ('1008','Extra bed','Дополнительная кровать','Əlavə çarpayı',NULL,'18.00','601.01.008',NULL),
  ('1009','Minibar','Мини-бар','Minibar','MINIBAR','18.00','601.01.009',NULL),
  ('1010','Laundry','Прачечная','Camaşırxana','LAUNDRY','18.00','601.01.010',NULL),
  ('1011','Transfer','Трансфер','Transfer','TRANSFER','18.00','601.01.011',NULL),
  ('1012','Taxi','Такси','Taksi',NULL,'18.00','601.01.012',NULL),
  ('1013','Tours','Экскурсии','Ekskursiyalar','TOUR','18.00','601.01.013',NULL),
  ('1014','Banquet','Банкет','Banket','BANQUET','18.00','601.01.014',NULL),
  ('1015','Cancellation and no-show fees','Штрафы за отмену и неявку','Ləğv və gəlməmə cərimələri',NULL,'18.00','601.01.015',NULL),
  ('1016','Damage and loss','Порча и утеря имущества','Zərər və itki',NULL,'18.00','601.01.016',NULL),
  ('1017','Other services','Прочие услуги','Digər xidmətlər',NULL,'18.00','601.01.017',NULL),
  ('1018','Concierge food','Еда через консьержа','Konsyerj vasitəsilə yemək','FOOD','18.00','601.01.018',NULL),
  ('1098','City tax','Туристический сбор','Turist rüsumu','CITY_TAX',NULL,'521.01',NULL),
  ('1099','Hotel discount','Скидка отеля','Otel endirimi','DISCOUNT','18.00','601.01.099',NULL),
  ('2001','Procedures','Процедуры','Prosedurlar','MEDICAL','18.00','601.02.001','23'),
  ('2002','Doctor consultation','Приём врача','Həkim qəbulu',NULL,'18.00','601.02.002',NULL),
  ('2003','Diagnostics','Диагностика','Diaqnostika',NULL,'18.00','601.02.003',NULL),
  ('2004','Laboratory','Анализы','Laboratoriya',NULL,'18.00','601.02.004',NULL),
  ('2005','Inpatient bed-day','Стационар','Stasionar',NULL,'18.00','601.02.005',NULL),
  ('2006','Medicines','Лекарства','Dərmanlar',NULL,'18.00','601.02.006',NULL),
  ('2007','Sanatorium program','Санаторная программа','Sanatoriya proqramı',NULL,'18.00','601.02.007',NULL),
  ('2099','Clinic discount','Скидка клиники','Klinika endirimi',NULL,'18.00','601.02.099',NULL),
  ('3001','Shop goods','Товары магазина','Mağaza malları',NULL,'18.00','601.03.001',NULL),
  ('3099','Shop discount','Скидка магазина','Mağaza endirimi',NULL,'18.00','601.03.099',NULL);

INSERT INTO nafta_codes
SELECT o.digit || c.cc,
       o.name_en || ' — ' || c.name_en,
       o.name_ru || ' — ' || c.name_ru,
       o.name_az || ' — ' || c.name_az,
       NULL, '18.00', '601.04.' || lpad(c.cc, 3, '0'), NULL
FROM (VALUES ('41','Naftani','Нафтаны','Naftanı'),
             ('42','Disco bar','Диско-бар','Disko-bar'),
             ('43','Xudmani','Худмани','Xudmani')) AS o(digit, name_en, name_ru, name_az)
CROSS JOIN (VALUES ('01','Food','Еда','Yemək'),
                   ('02','Beverages','Напитки','İçkilər'),
                   ('03','Alcohol','Алкоголь','Spirtli içkilər'),
                   ('04','Tobacco','Табак','Tütün'),
                   ('05','Hall rent','Аренда зала','Zal icarəsi'),
                   ('06','Entertainment','Развлечения','Əyləncə'),
                   ('99','Discount','Скидка','Endirim')) AS c(cc, name_en, name_ru, name_az);

-- Renumber legacy rows that already carry folio charges (charges keep their revenueCodeId).
UPDATE "RevenueCode" rc
   SET code = n.code
  FROM nafta_codes n
 WHERE rc."organizationId" = :'org'
   AND rc.code = n.legacy
   AND NOT EXISTS (
     SELECT 1 FROM "RevenueCode" x WHERE x."organizationId" = :'org' AND x.code = n.code
   );

-- Free the roles before reassigning them (unique per org).
UPDATE "RevenueCode" SET "systemRole" = NULL WHERE "organizationId" = :'org';

INSERT INTO "RevenueCode" (id, "organizationId", code, name, "nameEn", "nameRu", "nameAz", "taxTag", active)
SELECT gen_random_uuid()::text, :'org', n.code, n.name_en, n.name_en, n.name_ru, n.name_az, n.tax, true
  FROM nafta_codes n
ON CONFLICT ("organizationId", code) DO NOTHING;

UPDATE "RevenueCode" rc
   SET name = n.name_en, "nameEn" = n.name_en, "nameRu" = n.name_ru, "nameAz" = n.name_az,
       "taxTag" = n.tax, active = true, "systemRole" = n.role
  FROM nafta_codes n
 WHERE rc."organizationId" = :'org' AND rc.code = n.code;

-- GL routing: one finance leaf account per code.
INSERT INTO "HotelRevenueGlMapping" (id, "organizationId", "revenueCodeId", "glAccountCode", "updatedAt")
SELECT gen_random_uuid()::text, :'org', rc.id, n.gl, now()
  FROM nafta_codes n
  JOIN "RevenueCode" rc ON rc."organizationId" = :'org' AND rc.code = n.code
ON CONFLICT ("revenueCodeId") DO UPDATE SET "glAccountCode" = EXCLUDED."glAccountCode", "updatedAt" = now();

-- Drop old codes nobody references. Routing rules on them go first; GL mappings cascade.
CREATE TEMP TABLE nafta_drop ON COMMIT DROP AS
SELECT rc.id, rc.code FROM "RevenueCode" rc
 WHERE rc."organizationId" = :'org'
   AND rc.code NOT IN (SELECT code FROM nafta_codes)
   AND NOT EXISTS (SELECT 1 FROM "FolioCharge" c WHERE c."revenueCodeId" = rc.id)
   AND NOT EXISTS (SELECT 1 FROM "RatePlanPackageLine" p WHERE p."revenueCodeId" = rc.id)
   AND NOT EXISTS (SELECT 1 FROM "AddOn" a WHERE a."revenueCodeId" = rc.id);

DELETE FROM "FolioRoutingRule" WHERE "revenueCodeId" IN (SELECT id FROM nafta_drop);
DELETE FROM "RevenueCode" WHERE id IN (SELECT id FROM nafta_drop);

SELECT code AS dropped FROM nafta_drop ORDER BY code;
SELECT rc.code, rc.name, rc."systemRole", rc."taxTag", g."glAccountCode"
  FROM "RevenueCode" rc LEFT JOIN "HotelRevenueGlMapping" g ON g."revenueCodeId" = rc.id
 WHERE rc."organizationId" = :'org' ORDER BY rc.code;

COMMIT;
