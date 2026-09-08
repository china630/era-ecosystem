export type EcosystemModuleStatus = "trial" | "beta" | "premium";

export type EcosystemModuleCopy = {
  slug: string;
  title: string;
  tasks: string[];
  status: EcosystemModuleStatus;
  /** pricing_modules.key or "foundation" — live price overlay on the landing grid */
  pricingKey?: string;
  priceLabel?: string;
};

export type EcosystemSectionCopy = {
  id: string;
  title: string;
  modules: EcosystemModuleCopy[];
};

export type LandingEcosystemCopy = {
  statusTrial: string;
  statusBeta: string;
  statusPremium: string;
  premiumGlowBadge: string;
  sections: EcosystemSectionCopy[];
  disclaimer: string;
};

export const landingEcosystemRu: LandingEcosystemCopy = {
  statusTrial: "Включено в trial",
  statusBeta: "Спутник",
  statusPremium: "Premium plug-in",
  premiumGlowBadge: "AI / RPA",
  disclaimer:
    "*Палитра SKU 19 / 29 / 39 / 99 AZN. Банк CBS в списке — Sandbox / Pilot; production — Custom Quote. Счета входят в документы NAS (1000/мес, далее 5 AZN / 1000).",
  sections: [
    {
      id: "operational",
      title: "ERA Core — учёт (3 месяца trial)",
      modules: [
        {
          slug: "core_accounting",
          pricingKey: "foundation",
          priceLabel: "29 AZN / мес",
          title: "Foundation / NAS",
          status: "trial",
          tasks: [
            "Двойная запись NAS / MMUS и IFRS / MHBS",
            "Главная книга, ОСВ, закрытие периода",
            "1 ERP-логин и 1 юрлицо; 50 стр. OCR",
          ],
        },
        {
          slug: "cash_bank",
          pricingKey: "cash_bank_pro",
          priceLabel: "39 AZN / мес",
          title: "Касса и банк",
          status: "trial",
          tasks: [
            "Касса KMO/KSO, POS и банк",
            "Выписки и сверка",
            "Платёжный календарь (казначейство)",
          ],
        },
        {
          slug: "warehouse",
          pricingKey: "inventory",
          priceLabel: "19 AZN / мес",
          title: "Склад",
          status: "trial",
          tasks: ["Остатки в реальном времени", "FIFO и себестоимость", "Инвентаризация"],
        },
        {
          slug: "manufacturing",
          pricingKey: "manufacturing",
          priceLabel: "29 AZN / мес",
          title: "Производство и НЗП",
          status: "trial",
          tasks: ["Производственные заказы", "BOM / рецепты", "Счета 201 → 203 → 204"],
        },
        {
          slug: "fixed_assets",
          pricingKey: "fixed_assets",
          priceLabel: "19 AZN / мес",
          title: "Основные средства",
          status: "trial",
          tasks: ["Реестр ОС", "Амортизация NAS", "Выбытие и перемещения"],
        },
        {
          slug: "hr_payroll",
          pricingKey: "hr_full",
          priceLabel: "29 AZN / мес",
          title: "Кадры и зарплата",
          status: "trial",
          tasks: ["Штат и табель", "Начисления и налоги с ФОТ", "payroll / GL (не путать с Workforce 2/4 AZN)"],
        },
      ],
    },
    {
      id: "vertical",
      title: "Отраслевые спутники (Gate + ядра)",
      modules: [
        {
          slug: "hotel",
          pricingKey: "industry_hotel_pms",
          priceLabel: "Gate 29 AZN",
          title: "Hotel PMS",
          status: "beta",
          tasks: [
            "Gate: приложение + 5 номеров, далее 4 AZN/номер",
            "Core FO / HK / channel — отдельные SKU",
            "Resort-пакет: 188.70 AZN / мес",
          ],
        },
        {
          slug: "clinic",
          pricingKey: "industry_clinic",
          priceLabel: "Gate 29 AZN",
          title: "Clinic",
          status: "beta",
          tasks: [
            "Gate: расписание, приёмы, касса, 1 кабинет",
            "EMR 29 · лаборатория 29 · санаторий 29",
            "XOR с hotel_medical_sanatorium",
          ],
        },
        {
          slug: "fnb",
          pricingKey: "industry_fnb_pos",
          priceLabel: "Gate 29 AZN",
          title: "F&B POS",
          status: "beta",
          tasks: ["1 касса в Gate, далее 19 AZN", "KDS и PIN официанта", "XOR delivery vs F&B hub"],
        },
        {
          slug: "retail",
          pricingKey: "industry_retail",
          priceLabel: "Gate 29 AZN",
          title: "Retail POS",
          status: "beta",
          tasks: ["1 касса в Gate", "Промо XOR platform_loyalty", "Omni replenish"],
        },
        {
          slug: "auto",
          pricingKey: "industry_auto_service",
          priceLabel: "Gate 29 AZN",
          title: "Auto STO",
          status: "beta",
          tasks: ["1 пост в Gate", "B2B запчасти", "Нормы / TecDoc"],
        },
        {
          slug: "logistics",
          pricingKey: "industry_logistics",
          priceLabel: "Gate 29 AZN",
          title: "Logistics",
          status: "beta",
          tasks: ["2 ТС в Gate, далее 5 AZN", "Путевые и топливо", "Мобильный водитель / POD"],
        },
        {
          slug: "construction",
          pricingKey: "industry_construction",
          priceLabel: "Gate 29 AZN",
          title: "Construction",
          status: "beta",
          tasks: ["1 объект в Gate, далее 29 AZN", "Сметы и акты", "Субподряд"],
        },
        {
          slug: "wholesale",
          pricingKey: "industry_wholesale",
          priceLabel: "Gate 29 AZN",
          title: "Wholesale",
          status: "beta",
          tasks: ["1 склад в Gate", "Дистрибуция", "Опт на одном VÖEN"],
        },
        {
          slug: "crm",
          pricingKey: "industry_crm",
          priceLabel: "Gate 29 AZN",
          title: "CRM Field",
          status: "beta",
          tasks: ["1 место в Gate, далее 5 AZN", "Полевые продажи", "Не путать с Notifications Pack"],
        },
        {
          slug: "banking",
          pricingKey: "industry_banking",
          priceLabel: "Gate 99 AZN",
          title: "Bank CBS",
          status: "beta",
          tasks: [
            "Sandbox / Pilot, 1 филиал",
            "Не коммерческий ABS",
            "Production — Custom Quote от 25 000 AZN",
          ],
        },
      ],
    },
    {
      id: "premium",
      title: "Премиальные расширения Finance",
      modules: [
        {
          slug: "tax_pro",
          pricingKey: "tax_pro",
          priceLabel: "39 AZN / мес",
          title: "Tax Pro (e-taxes)",
          status: "premium",
          tasks: ["Синхронизация e-taxes", "Декларации без ручного копирования", "Контроль лимита НДС"],
        },
        {
          slug: "trade_pro",
          pricingKey: "trade_pro",
          priceLabel: "39 AZN / мес",
          title: "Trade Pro (таможня)",
          status: "premium",
          tasks: ["e-customs / BGD", "HS и пошлины", "Связка с закупками"],
        },
        {
          slug: "compliance_pro",
          pricingKey: "compliance_pro",
          priceLabel: "99 AZN / мес",
          title: "Compliance Pro",
          status: "premium",
          tasks: ["AI-консилиум рисков", "ƏMAS из ERP", "ERM-журнал"],
        },
      ],
    },
  ],
};

export const landingEcosystemAz: LandingEcosystemCopy = {
  statusTrial: "Trial-da daxildir",
  statusBeta: "Peyk",
  statusPremium: "Premium plug-in",
  premiumGlowBadge: "AI / RPA",
  disclaimer:
    "*SKU palitrası 19 / 29 / 39 / 99 AZN. Bank CBS siyahıda Sandbox / Pilot-dur; production — Custom Quote. Qaimələr NAS sənədlərinə daxildir (1000/ay, sonra 5 AZN / 1000).",
  sections: [
    {
      id: "operational",
      title: "ERA Core — uçot (3 aylıq trial)",
      modules: [
        {
          slug: "core_accounting",
          pricingKey: "foundation",
          priceLabel: "29 AZN / ay",
          title: "Foundation / NAS",
          status: "trial",
          tasks: [
            "NAS / MMUS və IFRS / MHBS ikiqat yazılış",
            "Baş kitab, OSV, dövr bağlanması",
            "1 ERP login və 1 hüquqi şəxs; 50 OCR səhifə",
          ],
        },
        {
          slug: "cash_bank",
          pricingKey: "cash_bank_pro",
          priceLabel: "39 AZN / ay",
          title: "Kassa və bank",
          status: "trial",
          tasks: ["KMO/KSO kassa, POS və bank", "Çıxarış və üzləşmə", "Ödəniş təqvimi"],
        },
        {
          slug: "warehouse",
          pricingKey: "inventory",
          priceLabel: "19 AZN / ay",
          title: "Anbar",
          status: "trial",
          tasks: ["Real vaxt qalıqları", "FIFO maya dəyəri", "İnventar"],
        },
        {
          slug: "manufacturing",
          pricingKey: "manufacturing",
          priceLabel: "29 AZN / ay",
          title: "İstehsalat və NAT",
          status: "trial",
          tasks: ["İstehsalat sifarişləri", "BOM / reseptlər", "201 → 203 → 204"],
        },
        {
          slug: "fixed_assets",
          pricingKey: "fixed_assets",
          priceLabel: "19 AZN / ay",
          title: "Əsas vəsaitlər",
          status: "trial",
          tasks: ["ƏV reyestri", "NAS amortizasiya", "Köçürmə və çıxarış"],
        },
        {
          slug: "hr_payroll",
          pricingKey: "hr_full",
          priceLabel: "29 AZN / ay",
          title: "Kadr və əməkhaqqı",
          status: "trial",
          tasks: ["Ştat və tabel", "FOT vergiləri", "payroll / GL (Workforce 2/4 AZN deyil)"],
        },
      ],
    },
    {
      id: "vertical",
      title: "Sənaye peykləri (Gate + nüvə)",
      modules: [
        {
          slug: "hotel",
          pricingKey: "industry_hotel_pms",
          priceLabel: "Gate 29 AZN",
          title: "Hotel PMS",
          status: "beta",
          tasks: [
            "Gate: tətbiq + 5 otaq, sonra 4 AZN/otaq",
            "Core FO / HK / channel — ayrıca SKU",
            "Resort paket: 188.70 AZN / ay",
          ],
        },
        {
          slug: "clinic",
          pricingKey: "industry_clinic",
          priceLabel: "Gate 29 AZN",
          title: "Clinic",
          status: "beta",
          tasks: [
            "Gate: cədvəl, qəbul, kassa, 1 kabinet",
            "EMR 29 · laboratoriya 29 · sanatoriya 29",
            "hotel_medical_sanatorium ilə XOR",
          ],
        },
        {
          slug: "fnb",
          pricingKey: "industry_fnb_pos",
          priceLabel: "Gate 29 AZN",
          title: "F&B POS",
          status: "beta",
          tasks: ["Gate-də 1 kassa, sonra 19 AZN", "KDS və ofisiant PIN", "XOR delivery vs F&B hub"],
        },
        {
          slug: "retail",
          pricingKey: "industry_retail",
          priceLabel: "Gate 29 AZN",
          title: "Retail POS",
          status: "beta",
          tasks: ["Gate-də 1 kassa", "Promo XOR platform_loyalty", "Omni replenish"],
        },
        {
          slug: "auto",
          pricingKey: "industry_auto_service",
          priceLabel: "Gate 29 AZN",
          title: "Auto STO",
          status: "beta",
          tasks: ["Gate-də 1 post", "B2B ehtiyat hissələri", "TecDoc normaları"],
        },
        {
          slug: "logistics",
          pricingKey: "industry_logistics",
          priceLabel: "Gate 29 AZN",
          title: "Logistics",
          status: "beta",
          tasks: ["Gate-də 2 NQ, sonra 5 AZN", "Yol vərəqəsi və yanacaq", "Sürücü mobil / POD"],
        },
        {
          slug: "construction",
          pricingKey: "industry_construction",
          priceLabel: "Gate 29 AZN",
          title: "Construction",
          status: "beta",
          tasks: ["Gate-də 1 obyekt, sonra 29 AZN", "Smeta və aktlar", "Subpodrat"],
        },
        {
          slug: "wholesale",
          pricingKey: "industry_wholesale",
          priceLabel: "Gate 29 AZN",
          title: "Wholesale",
          status: "beta",
          tasks: ["Gate-də 1 anbar", "Distribusiya", "Eyni VÖEN üzrə topdan"],
        },
        {
          slug: "crm",
          pricingKey: "industry_crm",
          priceLabel: "Gate 29 AZN",
          title: "CRM Field",
          status: "beta",
          tasks: ["Gate-də 1 yer, sonra 5 AZN", "Sahə satışları", "Notifications Pack deyil"],
        },
        {
          slug: "banking",
          pricingKey: "industry_banking",
          priceLabel: "Gate 99 AZN",
          title: "Bank CBS",
          status: "beta",
          tasks: [
            "Sandbox / Pilot, 1 filial",
            "Kommersiya ABS deyil",
            "Production — Custom Quote 25 000 AZN-dən",
          ],
        },
      ],
    },
    {
      id: "premium",
      title: "Finance premium genişləndirmələri",
      modules: [
        {
          slug: "tax_pro",
          pricingKey: "tax_pro",
          priceLabel: "39 AZN / ay",
          title: "Tax Pro (e-taxes)",
          status: "premium",
          tasks: ["e-taxes sinxron", "Bəyannamə əl ilə köçürmə olmadan", "ƏDV limiti"],
        },
        {
          slug: "trade_pro",
          pricingKey: "trade_pro",
          priceLabel: "39 AZN / ay",
          title: "Trade Pro (gömrük)",
          status: "premium",
          tasks: ["e-customs / BGD", "HS və rüsum", "Alışlarla əlaqə"],
        },
        {
          slug: "compliance_pro",
          pricingKey: "compliance_pro",
          priceLabel: "99 AZN / ay",
          title: "Compliance Pro",
          status: "premium",
          tasks: ["AI risk konsiliumu", "ƏMAS ERP-dən", "ERM jurnalı"],
        },
      ],
    },
  ],
};
