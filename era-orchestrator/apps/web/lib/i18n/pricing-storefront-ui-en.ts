import type { PricingStorefrontUiCopy } from "./pricing-storefront-copy";

export const uiEn: PricingStorefrontUiCopy = {
  heroTitle: "ERA: module builder 19 / 29 / 39 / 99 AZN",
  heroSubtitle:
    "Foundation 29 AZN + industry products (Gate) and modules. Bank CBS in the list is Sandbox / Pilot; production — Custom Quote.",
  ctaRegister: "Start 3 months free",
  ctaLogin: "Sign in",
  coreSuiteTitle: "ERA Core",
  coreSuiteIntro:
    "ERA Core (Foundation) — NAS/MMUS accounting. Standard modules — 19/29/39 AZN palette. Invoices count as documents (pack of 1000), not a separate 0.10 meter.",
  foundationTitle: "ERA Core (Foundation)",
  foundationDescription:
    "Accounting, postings, period close, and MMUS/MHBS compliance.",
  trialPromoText:
    "Register now and use all ERA Core modules free for 3 months.",
  trialPromoButton: "Start free — 3 months",
  coreTrialBadge: "First 3 months free",
  coreTrialPriceLabel: "0 AZN",
  corePostTrialTemplate: "{{price}} / mo after trial (first 3 months 0 AZN)",
  standardModulesTitle: "ERA Core standard modules",
  standardModulesHint:
    "Included in Core subscription or connected via bundles below — no separate single-SKU shelf.",
  bundlesTitle: "Ready bundles",
  bundlesHint:
    "Discounted standard modules — ready packs for typical business scenarios.",
  bundleCta: "Activate bundle",
  bundleDiscountSuffix: "off",
  bundlePopularBadge: "Popular",
  bundleSavingsLabel: "Savings",
  pricePerMonthSuffix: "/ mo",
  matrixTitle: "Unit prices and spend ceilings (spend tier)",
  matrixHint:
    "Pay for actual usage; tier ceiling is accumulated spend for the month (Baku).",
  spendTierMatrixHint:
    "3 months: ERA Core (Foundation) = 0 AZN; metered usage is billed. At tier ceiling — invoice same day; otherwise — 1st of month for prior month.",
  trialMeterMayBillLine:
    "Metered: documents (5 AZN / 1000 above NAS limit), OCR 0.02, WhatsApp 0.05, storage 0.50/GB. Invoices count as documents.",
  tierSpendCeilingTemplate: "up to {{amount}} / mo",
  tierSpendCeilingStarter: "0 AZN start",
  matrixMetricLabel: "Resource",
  tierCurrentLabel: "Current",
  tierSelectLabel: "Select tier",
  tierFreeForever: "Free forever",
  tierCustom: "Custom",
  tierPerMonth: "/ month",
  tierTrialLine: "0 AZN / first 3 mo",
  resourceUsers: "Foundation ERP login (above 1 × 2 AZN)",
  resourceInvoices: "Invoices (included in documents)",
  resourceDocuments: "Documents / 1000 pcs",
  resourceStorage: "Storage (above 20 GB)",
  resourceWhatsapp: "WhatsApp / mo",
  resourceOcr: "AI-OCR pages / mo",
  resourceWorkspaces: "Workspaces",
  premiumTitle: "Premium add-on modules",
  premiumHint:
    "Tax, customs, compliance, and external audit extensions — on top of Core.",
  premiumLockedTitle: "Commercial status required (TIER 1+)",
  premiumUpgradeCta: "Upgrade to Tier 1+",
  calculatorDueTodayLabel:
    "Due today (trial): {{amount}}",
  calculatorPostpaidLabel:
    "Modules after trial (no meters or capacity): {{amount}}",
  calculatorBakuNotice:
    "All limit calculations and billing period close run on the 1st of each calendar month in Baku time (Asia/Baku).",
  standardModules: {
    core_accounting: {
      name: "Core accounting",
      subtitle: "Base accounting, postings, and period close per MMUS/MHBS",
      bullets: ["NAS / MMUS", "MHBS / IFRS", "Postings and GL", "Period close"],
    },
    cash_bank: {
      name: "Cash and bank",
      subtitle: "Cash, POS, and bank in one payments contour",
      bullets: ["Cash and POS", "Bank statements", "Payments and orders", "Balance reconciliation"],
    },
    supply_sales: {
      name: "Supply, sales, and warehouse",
      subtitle: "Procurement, sales, and inventory",
      bullets: ["Purchases and sales", "FIFO and balances", "Stock counts", "Shipment cost"],
    },
    manufacturing_wip: {
      name: "Manufacturing and WIP",
      subtitle: "Output, recipes, and WIP accounting",
      bullets: ["WIP 203", "Recipes and specs", "Finished goods output", "Costing"],
    },
    fixed_assets: {
      name: "Fixed assets",
      subtitle: "CapEx, depreciation, and FA register",
      bullets: ["Capitalization", "Depreciation", "Transfers and disposal", "FA register"],
    },
    hr_payroll: {
      name: "HR and payroll",
      subtitle: "Staff, timesheet, and payroll",
      bullets: ["Staffing table", "Timesheet", "Accruals", "Payroll sheets and payouts"],
    },
    ifrs_mapping: {
      name: "IFRS / MHBS",
      subtitle: "Parallel IFRS contour on NAS",
      bullets: ["IFRS chart of accounts", "Parallel postings", "MHBS reports"],
    },
    consolidation_pro: {
      name: "Holding consolidation",
      subtitle: "Consolidation of multiple legal entities",
      bullets: ["Eliminations", "Holding reports", "Multiple VÖEN"],
    },
  },
  premiumFeatures: {
    tax_pro: {
      description: "Taxes and e-Taxes without copy-paste.",
      bullets: [
        "Auto-sync e-Taxes and declarations",
        "RPA filing without copy-paste",
        "Real-time VAT threshold control",
      ],
    },
    trade_pro: {
      description: "BGD customs and Trade Pro for imports.",
      bullets: [
        "BGD / e-customs prefill",
        "HS codes and duties from KM catalog",
        "Cost and input VAT postings",
      ],
    },
    compliance_pro: {
      description: "ERM, AI Council, and labor compliance.",
      bullets: [
        "AI Council of Elders — risk audit",
        "ƏMAS: employment contracts in one click",
        "ERM dashboard and mitigation journal",
      ],
    },
    audit_hub: {
      description: "External auditor workspace and guest access.",
      bullets: [
        "Engagement, samples, and timeline",
        "NAS/IFRS reports for auditor",
        "Bulk export and guest invites",
      ],
    },
    mgmt_budget_pro: {
      description: "Management budget for commercial orgs.",
      bullets: [
        "Annual plan without NAS-Gov lines",
        "Commitment reserve soft/hard",
        "Plan vs actual on /gov-budget",
      ],
    },
  },
  bundles: {
    cash_warehouse: {
      name: "Cash & warehouse",
      moduleLine: "Cash & Bank Pro + Warehouse",
    },
    hr_ifrs: {
      name: "HR & IFRS",
      moduleLine: "HR + IFRS mapping",
    },
    trade_ops: {
      name: "Trade & operations",
      moduleLine: "Warehouse + Manufacturing",
    },
    hotel_city: {
      name: "Hotel City",
      moduleLine: "Front Office, HK, Night Audit, Front Cash",
    },
    hotel_resort: {
      name: "Hotel Resort",
      moduleLine: "City + Channel, Yield, Guests, SPA, Banquets",
    },
    hotel_sanatorium: {
      name: "Hotel Sanatorium",
      moduleLine: "Resort + Medical & Sanatorium. Clinic sanatorium chart is a separate SKU.",
    },
    banking_retail: {
      name: "Banking Retail (Sandbox / Pilot)",
      moduleLine: "Core, deposits, loans, cards, payments, DBO, AML",
    },
    banking_universal: {
      name: "Banking Universal (Sandbox / Pilot)",
      moduleLine: "Full CBS set — production Custom Quote from 25 000 AZN",
    },
  },
  hospitalityTitle: "Hotel PMS — Hospitality",
  hospitalityIntro:
    "Industry satellite app and hotel_* modules (not platform add-ons).",
  hospitalityGateLabel: "Hotel PMS (app access)",
  hospitalityBundleSelect: "Select bundle",
  hospitalityModuleNames: {
    industry_hotel_pms: "Hotel PMS",
    hotel_core: "PMS Core (Front Office, Front Cash, Night Audit)",
    hotel_housekeeping: "Housekeeping & Room Rack",
    hotel_migration_pro: "Migration PRO",
    hotel_distribution: "Channel Manager (OTA & Direct)",
    hotel_guest_experience: "Guest Profiles & Tasks",
    hotel_spa_scheduling: "SPA & Scheduling",
    hotel_transfers: "Transfers",
    hotel_banquets: "Banquets & BEO",
    hotel_medical_sanatorium: "Medical & Sanatorium",
    hotel_setup_advanced: "Advanced master data",
  },
  industriesTitle: "Industry products",
  industriesIntro:
    "Gate 29 AZN (bank — 99) opens the app. Most verticals include 1 capacity unit in Gate. Clinic counts cabinets and beds on EMR / sanatorium / inpatient modules.",
  industryCapacityTemplate: "In Gate: {{included}} {{unit}}, then {{price}} per unit.",
  bankingSandboxNote:
    "CBS prices are Sandbox / Pilot. Production contour (AzeriCard / AZIPS) — Custom Quote, setup from 25 000 AZN.",
  platformAddonsTitle: "Platform add-ons",
  platformAddonsHint:
    "Cross-vertical orchestrator services. Workforce — 2 / 4 / 6 AZN per person (Essential / Professional / Premium).",
  platformAddonsXor:
    "XOR: Data HUB Bronze / Silver / Gold · Loyalty XOR Retail promotions · Delivery XOR F&B delivery hub.",
  industryCopy: {
    industry_hotel_pms: {
      title: "Hotel PMS",
      intro: "Front office, HK, Channel Manager, SPA. Resort list 232 AZN × 15% = 197.20 AZN.",
      gateLabel: "Hotel PMS Gate (app + 5 rooms)",
      capacityUnit: "room",
    },
    industry_clinic: {
      title: "Clinic",
      intro:
        "EMR 39 (5 cabinets), lab 29, sanatorium 99 (5 cabinets), nurse post 19, inpatient 39 (5 beds), telehealth 39, insurance 39. Overage 19 AZN. Rooms count once.",
      gateLabel: "Clinic Gate (app, no cabinet quota on Gate)",
      capacityUnit: "cabinet",
    },
    industry_fnb_pos: {
      title: "F&B POS",
      intro: "Kitchen KDS, waiter PIN, recipes. XOR: platform_delivery vs fnb_delivery_hub.",
      gateLabel: "F&B Gate (1 POS)",
      capacityUnit: "POS",
    },
    industry_retail: {
      title: "Retail POS",
      intro: "Promo and omni. XOR: platform_loyalty vs retail_promotions.",
      gateLabel: "Retail Gate (1 POS)",
      capacityUnit: "POS",
    },
    industry_auto_service: {
      title: "Auto Service",
      intro: "B2B parts and TecDoc norms.",
      gateLabel: "Auto Gate (1 bay)",
      capacityUnit: "bay",
    },
    industry_logistics: {
      title: "Logistics",
      intro: "Trip sheets, fuel, driver mobile.",
      gateLabel: "Logistics Gate (2 vehicles)",
      capacityUnit: "vehicle",
    },
    industry_construction: {
      title: "Construction",
      intro: "Sites, progress acts, subcontractors.",
      gateLabel: "Construction Gate (1 site)",
      capacityUnit: "site",
    },
    industry_wholesale: {
      title: "Wholesale",
      intro: "Distribution warehouse.",
      gateLabel: "Wholesale Gate (1 warehouse)",
      capacityUnit: "warehouse",
    },
    industry_crm: {
      title: "CRM",
      intro: "Field sales. CRM seat 5 AZN above 1 in Gate.",
      gateLabel: "CRM Gate (1 seat)",
      capacityUnit: "seat",
    },
    industry_banking: {
      title: "Bank CBS",
      intro: "Fintech gateway and 1 branch in Gate 99. Not a commercial ABS.",
      gateLabel: "Banking Gate (Sandbox / Pilot, 1 branch)",
      capacityUnit: "branch",
    },
  },
  industryModuleNames: {
    clinic_registry_emr: "EMR / visit protocols",
    clinic_lab: "Laboratory",
    clinic_sanatorium: "Sanatorium clinical chart",
    clinic_insurance: "Insurance / DMS",
    clinic_inpatient: "Inpatient / beds",
    clinic_telehealth: "Telehealth",
    clinic_nurse_roster: "Nurse station / procedures",
    construction_daily_logs: "Daily log / punch list",
    construction_machinery: "Equipment hours",
    construction_boq: "BOQ estimate (ops)",
    construction_estimate_hierarchy: "5-level estimate hierarchy",
    construction_smeta_rate_engine: "Estimate rate engine",
    construction_schedule: "Schedule / Gantt",
    construction_cde: "CDE / drawings",
    construction_project_depth: "Project depth (RFI / change / parties)",
    construction_bim_lite: "BIM lite (element refs)",
    crm_geo_visits: "Geo visits",
    crm_omni_inbox: "Omni inbox",
    crm_selections: "Selections (after sale)",
    crm_warranty: "Warranty tickets",
  },
  platformAddonNames: {
    platform_notifications: "Notifications Pack",
    platform_storage: "Cloud Storage (20 GB in SKU)",
    platform_reference_data: "Data HUB Bronze",
    platform_datahub_silver: "Data HUB Silver",
    platform_datahub_gold: "Data HUB Gold",
    platform_booking: "Online Booking",
    platform_portal: "Client Portal",
    platform_domain: "White-label domain (one login host)",
    platform_domain_org: "White-label domain org pack (all satellite logins)",
    platform_loyalty: "Loyalty (XOR retail promo)",
    platform_delivery: "Delivery (XOR F&B hub)",
  },
  industryRegisterCta: "Sign up",
  industryAfterSignup: "individual modules are in Billing → Modules after sign-in.",
};
