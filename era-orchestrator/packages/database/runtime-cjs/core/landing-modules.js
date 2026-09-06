"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANDING_MODULE_MARKETING_DEFAULTS = void 0;
exports.LANDING_MODULE_MARKETING_DEFAULTS = [
    {
        moduleSlug: "finance",
        sortOrder: 0,
        names: {
            az: "Maliyyə və uçot",
            ru: "Финансы и учёт",
        },
        descriptions: {
            az: "NAS kitabı, kassa, bank, satış və hesabatlar — bir platformada.",
            ru: "План счетов NAS, касса, банк, продажи и отчёты — в одной платформе.",
        },
        tasks: {
            az: [
                "Satış və alış sənədləri",
                "Kassa və bank əməliyyatları",
                "Debitor/kreditor və P&L",
                "Aylıq bağlanış",
            ],
            ru: [
                "Счета и акты продаж/закупок",
                "Касса и банковские операции",
                "Дебиторка/кредиторка и P&L",
                "Закрытие месяца",
            ],
        },
    },
    {
        moduleSlug: "manufacturing_wip",
        sortOrder: 1,
        names: {
            az: "İstehsalat (WIP)",
            ru: "Производство (WIP)",
        },
        descriptions: {
            az: "BOM, istehsalat sifarişləri və WIP hesabları (203/201/204).",
            ru: "Спецификации, производственные заказы и WIP-счета (203/201/204).",
        },
        tasks: {
            az: [
                "Reseptlər (BOM)",
                "Sifariş: başlat → tamamla",
                "Material xərcləri və buraxılış",
                "Anbar inteqrasiyası",
            ],
            ru: [
                "Рецепты (BOM)",
                "Заказ: старт → завершение",
                "Списание материалов и выпуск",
                "Интеграция со складом",
            ],
        },
    },
    {
        moduleSlug: "fixed_assets",
        sortOrder: 2,
        names: {
            az: "Əsas vəsaitlər",
            ru: "Основные средства",
        },
        descriptions: {
            az: "Amortizasiya: xətti, azalan qalıq və istehsal həcminə görə.",
            ru: "Амортизация: линейная, убывающий остаток и по объёму выработки.",
        },
        tasks: {
            az: [
                "ƏV reyestri",
                "Aylıq amortizasiya",
                "UoP aylıq istehsal uçotu",
                "Dr 713 / Cr 112 keçidləri",
            ],
            ru: [
                "Реестр ОС",
                "Месячное начисление",
                "UoP — ввод выработки за месяц",
                "Проводки Дт 713 / Кт 112",
            ],
        },
    },
    {
        moduleSlug: "industry_solutions",
        sortOrder: 3,
        names: {
            az: "Sənaye həlləri",
            ru: "Отраслевые решения",
        },
        descriptions: {
            az: "Hotel, klinika, F&B, retail, auto, logistika, tikinti, wholesale, CRM və bank Gate — palitra 19/29/39/99.",
            ru: "Hotel, клиника, F&B, retail, auto, логистика, стройка, wholesale, CRM и bank Gate — палитра 19/29/39/99.",
        },
        tasks: {
            az: [
                "Gate tətbiqi açır + 1 tutum vahidi",
                "Nüvələr (hotel_core, EMR) ayrıca SKU",
                "Hotel Sanatorium XOR clinic sanatorium",
                "Bank CBS — Sandbox / Pilot",
            ],
            ru: [
                "Gate открывает приложение + 1 единицу ёмкости",
                "Ядра (hotel_core, EMR) — отдельные SKU",
                "Hotel Sanatorium XOR clinic sanatorium",
                "Bank CBS — Sandbox / Pilot",
            ],
        },
    },
];
