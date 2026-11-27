import type { LandingMarketingCopy } from "./landing-copy";
import { landingEcosystemEn } from "./landing-ecosystem-data";

export const landingMarketingEn: LandingMarketingCopy = {
  chrome: {
    login: "Sign in",
    navSatellites: "Products",
  },
  footer: "ERA 365 — accounting and industry products platform for Azerbaijan",
  hero: {
    title: "Accounting and industry solutions — one platform",
    subtitle:
      "ERA Core, hotel, clinic, POS, and Data HUB. Palette 19 / 29 / 39 / 99 AZN. 3-month trial, no card required.",
    ctaPrimary: "Start 3 months free",
    ctaSecondary: "Full catalog",
    ctaMicrocopy: "No card required • Cancel anytime",
    navPricing: "Pricing",
  },
  hub: {
    coreTitle: "ERA Core",
    coreBody: "NAS/MMUS accounting: GL, cash, warehouse, manufacturing, FA, HR. Foundation 29 AZN.",
    coreCta: "About Finance core",
    satellitesTitle: "Industry products",
    satellitesIntro: "Gate — workspace and base capacity. Cores and bundles — on the product page and in the catalog.",
    dataHubTitle: "Data HUB",
    dataHubBody: "Reference data and exchange. Bronze / Silver / Gold — only one tier.",
    dataHubCta: "Data HUB",
    addonsTitle: "Platform add-ons",
    addonsBody: "Notifications, storage, loyalty, delivery, Workforce 2/4 AZN. XOR on the catalog shelf.",
    addonsCta: "Add-ons in catalog",
    catalogCta: "Build subscription",
  },
  trial: {
    cornerBadge: "Special offer to get started",
    offerPrimary: "0 AZN / 3 months",
    offerSubline: "Foundation and industry Gates in trial",
    checklistTitle: "Activated in trial",
    checklist: [
      "NAS / MMUS and IFRS / MHBS — double entry",
      "Cash, warehouse, manufacturing, FA, and HR",
      "Products: Hotel, Clinic, F&B, Retail… (Gate)",
      "Documents 1000/mo in NAS; OCR 50 pages",
    ],
    disclaimer:
      "*Premium Finance (tax_pro, trade_pro, compliance_pro) and production CBS — outside trial list price.",
  },
  ecosystem: landingEcosystemEn,
  zeroKnowledge: {
    title: "Zero-Knowledge level confidentiality",
    claims: [
      {
        title: "Client-side encryption",
        detail:
          "Data is encrypted in the browser before it hits the network — plaintext never leaves your device.",
      },
      {
        title: "Zero access",
        detail:
          "ERA staff cannot view your data: neither accounting nor satellites.",
      },
      {
        title: "Government security anchor",
        detail:
          "Recovery keys in crypto escrow — unlock only via ASAN İmza / SİMA.",
      },
    ],
    identityEyebrow: "Government identity",
    encryptionNote: "End-to-end encryption · keys on the client",
    badges: ["ASAN İmza", "SİMA"],
  },
  legacyCompare: {
    title: "ERA Finance vs legacy 1C platforms",
    subtitle:
      "Eight head-to-head rounds: why the cloud contour beats the on-prem box.",
    legacyBrand: "Legacy (1C)",
    eraBrand: "ERA Finance",
    rows: [
      {
        topic: "Availability",
        legacy: "Slow local servers and VPN — office-only access",
        era: "Instant cloud web and mobile access 24/7 from anywhere",
      },
      {
        topic: "Tax compliance",
        legacy: "Paid manual developer patches on every law change",
        era: "Free instant auto-updates for Azerbaijan legislation",
      },
      {
        topic: "Government portals",
        legacy: "Manual XML between portals and accounting",
        era: "Native browser extension: e-taxes and e-customs without routine",
      },
      {
        topic: "HR and ƏMAS",
        legacy:
          "Manual staffing exports, double entry of labor contracts on ƏMAS, and penalty risk from delays",
        era: "Automatic HR sync with the state ƏMAS portal. Register and close contracts from ERP in one click",
      },
      {
        topic: "WhatsApp",
        legacy: "Expensive third-party plugins to send documents",
        era: "Built-in invoice and act to counterparty in one click",
      },
      {
        topic: "GAAP standards",
        legacy: "Isolated NAS and IFRS silos — double entry",
        era: "Parallel NAS/MMUS and IFRS/MHBS in one contour",
      },
      {
        topic: "Document capture",
        legacy: "Hours of manual entry from paper invoices",
        era: "Neuro-OCR: recognition and prefill in 5 seconds",
      },
      {
        topic: "VAT safety",
        legacy: "Human error and missed turnover threshold",
        era: "Daily AI Council of Elders and 200,000 AZN guard",
      },
    ],
  },
  bottomCta: {
    headline: "Ready to move your business to supersonic speed?",
    subtext: "Sign up today and get 3 months of full access with no commitment",
    primary: "Start 3 months free",
    secondary: "Sign in",
    ctaMicrocopy: "No card required • Cancel anytime",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        id: "what",
        question: "What is ERA 365?",
        answer:
          "Accounting (ERA Core) and industry products for Azerbaijan: hotel, clinic, POS, logistics, and other workspaces in one contour with MDM and subscription.",
      },
      {
        id: "pricing",
        question: "How is pricing structured?",
        answer:
          "SKU palette 19 / 29 / 39 / 99 AZN. Foundation 29. Gate opens the product and base capacity. Documents, OCR, SMS, and storage are meters. Full builder — on the pricing page.",
      },
      {
        id: "xor",
        question: "Which modules cannot run together?",
        answer: "Only one SKU per group.",
        chips: [
          "Data HUB Bronze / Silver / Gold",
          "Workforce Essential / Professional / Premium",
          "Loyalty XOR Retail promo",
          "Delivery XOR F&B hub",
          "Hotel XOR Clinic sanatorium",
        ],
      },
      {
        id: "trial",
        question: "What is in the 3-month trial?",
        answer:
          "Foundation and industry Gates — 0 AZN, no card. Premium Finance and production CBS are not in the trial list. OCR above 50 pages and documents above 1000/mo may bill.",
      },
      {
        id: "register",
        question: "Where do I register?",
        answer:
          "At app.era-365.online: account, VÖEN, and modules. After sign-in, products open from the launcher. Registration is not on /industry pages — those are for signed-in users only.",
      },
    ],
  },
  features: {
    finance: {
      eyebrow: "Finance core",
      title: "Cash, bank, and reconciliation without gaps",
      body: "KMO/KSO, statements, and automatic payment matching — one cash journal with NAS postings.",
      bullets: [
        "Cash journal and bank cards in one contour",
        "Statement reconciliation with invoices and counterparties",
        "Real-time control of 101* and 221–224 balances",
      ],
    },
    manufacturing: {
      eyebrow: "Manufacturing Pro",
      title: "Work-in-progress control",
      body: "Transparent WIP: from materials on 201 through costs on 203 to finished goods.",
      bullets: [
        "BOM and production orders with stages",
        "Accounts 201 → 203 → 204 without costing black holes",
        "Integration with warehouse and batch output",
      ],
    },
    tax: {
      eyebrow: "Tax shield",
      title: "Shield from mandatory VAT registration",
      body: "YTD turnover vs 160k / 190k / 200k AZN thresholds — warning before mandatory VAT registration.",
      bullets: [
        "Daily limit recalculation per organization",
        "RiskAudit and alerts as you approach the threshold",
        "Clear view for owner and accountant",
      ],
    },
  },
  premium: {
    title: "Premium extensions for confident growth",
    subtitle:
      "Advanced plug-in modules with AI and RPA — on top of the ops core when you are ready to automate compliance and government portals.",
    plugInBadge: "Premium module",
    items: [
      {
        slug: "compliance_pro",
        name: "Risk & Compliance Pro · Council of Elders",
        description:
          "Multi-agent AI consilium for risks, VÖEN checks, and compliance scenarios before they become fines.",
        highlights: ["Council of Elders", "ERM panel", "RiskAudit journal"],
      },
      {
        slug: "tax_pro",
        name: "Tax Pro · e-Taxes RPA",
        description:
          "e-taxes portal automation via ERA Finance Assistant: less copy-paste, faster filing.",
        highlights: ["RPA for e-taxes", "DVX scenarios", "Browser extension"],
      },
      {
        slug: "trade_pro",
        name: "Trade Pro · customs BGD",
        description:
          "Capture and process BGD declarations from e-customs, linked to procurement and foreign trade.",
        highlights: ["BGD import", "e-customs portal", "Foreign trade and warehouse"],
      },
    ],
  },
  mocks: {
    finance: {
      panelTitle: "Bank statement · reconciliation",
      colDate: "Date",
      colDescription: "Description",
      colAmount: "Amount",
      colStatus: "Status",
      matched: "Matched",
      pending: "Pending",
      rows: [
        {
          date: "12.05.2026",
          description: "Supplier payment · INV-2041",
          amount: "−4 820,00",
          status: "matched",
        },
        {
          date: "11.05.2026",
          description: "Customer receipt · SO-118",
          amount: "+12 400,00",
          status: "matched",
        },
        {
          date: "10.05.2026",
          description: "Bank fee",
          amount: "−18,50",
          status: "pending",
        },
      ],
    },
    manufacturing: {
      panelTitle: "Production order",
      orderId: "MO-2026-0142",
      statusLabel: "In progress",
      progress: "68% · Assembly stage",
      accountFlow: "201 Materials → 203 WIP → 204 finished goods",
    },
    tax: {
      panelTitle: "Turnover limit monitor",
      ytdLabel: "Year-to-date turnover",
      limitLabel: "Mandatory VAT threshold",
      warning: "Warning: less than 15% to the limit",
      amount: "152 400 AZN",
      limit: "160 000 AZN",
    },
  },
};

