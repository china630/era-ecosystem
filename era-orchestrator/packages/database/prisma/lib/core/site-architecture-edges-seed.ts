import type {
  PrismaClient,
  SiteArchitectureEdgeKind,
  SiteArchitectureRealizationStatus,
} from "../../../generated/client";

type LocaleMap = { az?: string; ru?: string; en?: string };

type ArchitectureEdgeSeed = {
  fromKey: string;
  toKey: string;
  kind: SiteArchitectureEdgeKind;
  realizationStatus: SiteArchitectureRealizationStatus;
  sortOrder: number;
  labels: LocaleMap;
  visibility?: "VISIBLE" | "HIDDEN" | "DRAFT";
};

/** Diagram keys not backed by satellites table rows. */
export const ARCHITECTURE_PLATFORM_ORCHESTRATOR_KEY = "platform_orchestrator";
export const ARCHITECTURE_CONNECTED_PRODUCTS_KEY = "__connected_products__";
export const ARCHITECTURE_STAFF_PROVISION_REMAINDER_KEY = "__staff_provision_remainder__";
export const ARCHITECTURE_ANALYTICS_EMITTERS_KEY = "__analytics_emitters__";
export const ARCHITECTURE_REFERENCE_CONSUMERS_KEY = "__reference_consumers__";
export const ARCHITECTURE_READ_STATUS_CLIENT_KEY = "__read_status_client__";
export const ARCHITECTURE_READ_STATUS_PROVIDER_KEY = "__read_status_provider__";

const L = (
  en: string,
  ru = en,
  az = en,
): LocaleMap => ({ en, ru, az });

/**
 * Canonical 48 edges from docs/adr/ADR-integration-map-target.md (2026-11-27).
 * Idempotent seed: never updates rows where autoManaged=false.
 */
export const SITE_ARCHITECTURE_EDGE_SEEDS: ReadonlyArray<ArchitectureEdgeSeed> = [
  // §2.1 live (22)
  {
    fromKey: "industry_hotel_pms",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 1,
    labels: L("Invoices, night audit, reservations", "Счета, ночной аудит, брони", "Hesab-faktura, gecə auditi, rezervasiya"),
  },
  {
    fromKey: "industry_fnb_pos",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 2,
    labels: L("Sale, shift, stock write-off", "Продажа, смена, списание", "Satış, növbə, silinmə"),
  },
  {
    fromKey: "industry_retail",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 3,
    labels: L("Sale, shift, warehouse", "Продажа, смена, склад", "Satış, növbə, anbar"),
  },
  {
    fromKey: "industry_clinic",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 4,
    labels: L("Visit, lab, ward day", "Визит, лаборатория, койко-день", "Vizit, laboratoriya, çarpayı-günü"),
  },
  {
    fromKey: "industry_auto_service",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 5,
    labels: L("Closed work order", "Закрытый наряд", "Bağlanmış iş sifarişi"),
  },
  {
    fromKey: "industry_logistics",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 6,
    labels: L("Completed trip", "Завершённый рейс", "Tamamlanmış reys"),
  },
  {
    fromKey: "industry_wholesale",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 7,
    labels: L("Confirmed order", "Подтверждённый заказ", "Təsdiqlənmiş sifariş"),
  },
  {
    fromKey: "industry_construction",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 8,
    labels: L("Progress act, change request, SOV", "Акт, доп. соглашение, SOV", "Akt, əlavə razılaşma, SOV"),
  },
  {
    fromKey: "industry_crm",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 9,
    labels: L("Lead convert, logged visit", "Конвертация лида, визит", "Lid konvertasiyası, vizit"),
  },
  {
    fromKey: "industry_banking",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 10,
    labels: L("Daily GL summary", "Суточный GL-summary", "Gündəlik GL xülasəsi"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "live",
    sortOrder: 11,
    labels: L("Timesheet, HR lifecycle", "Табель, кадровый контур", "İş vaxtı cədvəli, HR"),
  },
  {
    fromKey: "industry_fnb_pos",
    toKey: "industry_hotel_pms",
    kind: "FOLIO_POST",
    realizationStatus: "live",
    sortOrder: 12,
    labels: L("Folio post & settlement", "Фолио и расчёт", "Folio və hesablaşma"),
  },
  {
    fromKey: "industry_clinic",
    toKey: "industry_hotel_pms",
    kind: "FOLIO_POST",
    realizationStatus: "live",
    sortOrder: 13,
    labels: L("Folio post & settlement", "Фолио и расчёт", "Folio və hesablaşma"),
  },
  {
    fromKey: "industry_retail",
    toKey: "industry_hotel_pms",
    kind: "FOLIO_POST",
    realizationStatus: "live",
    sortOrder: 14,
    labels: L("Folio post & settlement", "Фолио и расчёт", "Folio və hesablaşma"),
  },
  {
    fromKey: "industry_hotel_pms",
    toKey: "industry_clinic",
    kind: "LIFECYCLE",
    realizationStatus: "live",
    sortOrder: 15,
    labels: L("Guest stay lifecycle", "Жизненный цикл гостя", "Qonaq yaşam dövrü"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_hotel_pms",
    kind: "STAFF_PROVISION",
    realizationStatus: "live",
    sortOrder: 16,
    labels: L("Staff provision", "Провижининг кадров", "Kadr təminatı"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_fnb_pos",
    kind: "STAFF_PROVISION",
    realizationStatus: "live",
    sortOrder: 17,
    labels: L("Staff provision", "Провижининг кадров", "Kadr təminatı"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_retail",
    kind: "STAFF_PROVISION",
    realizationStatus: "live",
    sortOrder: 18,
    labels: L("Staff provision", "Провижининг кадров", "Kadr təminatı"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_clinic",
    kind: "STAFF_PROVISION",
    realizationStatus: "live",
    sortOrder: 19,
    labels: L("Staff provision", "Провижининг кадров", "Kadr təminatı"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_construction",
    kind: "STAFF_PROVISION",
    realizationStatus: "live",
    sortOrder: 20,
    labels: L("Staff provision", "Провижининг кадров", "Kadr təminatı"),
  },
  {
    fromKey: "industry_construction",
    toKey: "platform_workforce",
    kind: "OPS_HANDOFF",
    realizationStatus: "live",
    sortOrder: 21,
    labels: L("Timesheet batch import", "Импорт табеля", "İş vaxtı cədvəli importu"),
  },
  {
    fromKey: ARCHITECTURE_CONNECTED_PRODUCTS_KEY,
    toKey: ARCHITECTURE_PLATFORM_ORCHESTRATOR_KEY,
    kind: "PLATFORM_IDENTITY",
    realizationStatus: "live",
    sortOrder: 22,
    labels: L(
      "Identity, billing, catalog, events",
      "Идентичность, биллинг, каталог, события",
      "Şəxsiyyət, billing, kataloq, hadisələr",
    ),
  },
  // §2.2 partial (6)
  {
    fromKey: "industry_wholesale",
    toKey: "industry_retail",
    kind: "OPS_HANDOFF",
    realizationStatus: "partial",
    sortOrder: 23,
    labels: L("Order / stock handoff", "Передача заказа / остатка", "Sifariş / qalıq ötürülməsi"),
  },
  {
    fromKey: "industry_crm",
    toKey: "industry_clinic",
    kind: "CRM_PARTY",
    realizationStatus: "partial",
    sortOrder: 24,
    labels: L("Appointment intent", "Намерение записи", "Görüş niyyəti"),
  },
  {
    fromKey: "platform_workforce",
    toKey: "industry_banking",
    kind: "STAFF_PROVISION",
    realizationStatus: "partial",
    sortOrder: 25,
    labels: L("Bank HR provisioning (MVP)", "HR банка (MVP)", "Bank HR təminatı (MVP)"),
  },
  {
    fromKey: "platform_datahub",
    toKey: "finance_core",
    kind: "REFERENCE_DATA",
    realizationStatus: "partial",
    sortOrder: 26,
    labels: L("Reference data cache", "Справочники в ядре", "Arayış məlumatı keşi"),
  },
  {
    fromKey: "platform_datahub",
    toKey: "industry_construction",
    kind: "REFERENCE_DATA",
    realizationStatus: "partial",
    sortOrder: 27,
    labels: L("Construction materials catalog", "Номенклатура стройматериалов", "Tikinti materialları"),
  },
  {
    fromKey: "industry_banking",
    toKey: "banking_dbo",
    kind: "BANK_CHANNEL",
    realizationStatus: "partial",
    sortOrder: 28,
    labels: L("DBO & client channels", "ДБО и клиентские каналы", "DBO və müştəri kanalları"),
  },
  // §2.3 planned (20)
  {
    fromKey: "industry_hotel_pms",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 29,
    labels: L("Guest / company party", "Гость / компания", "Qonaq / şirkət"),
  },
  {
    fromKey: "industry_clinic",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 30,
    labels: L("Patient party", "Пациент", "Xəstə"),
  },
  {
    fromKey: "industry_construction",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 31,
    labels: L("Customer, warranty case", "Заказчик, гарантия", "Müştəri, zəmanət"),
  },
  {
    fromKey: "industry_auto_service",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 32,
    labels: L("Vehicle owner party", "Владелец ТС", "NV sahibi"),
  },
  {
    fromKey: "industry_retail",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 33,
    labels: L("Shopper / loyalty", "Покупатель / лояльность", "Alıcı / loyallıq"),
  },
  {
    fromKey: "industry_wholesale",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 34,
    labels: L("Wholesale counterparty", "Контрагент опта", "Topdan kontragent"),
  },
  {
    fromKey: "industry_logistics",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 35,
    labels: L("Shipper / consignee", "Грузоотправитель / получатель", "Göndərən / alıcı"),
  },
  {
    fromKey: "industry_fnb_pos",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 36,
    labels: L("Guest / regular guest", "Гость / постоянный", "Qonaq / daimi qonaq"),
  },
  {
    fromKey: "industry_banking",
    toKey: "industry_crm",
    kind: "CRM_PARTY",
    realizationStatus: "planned",
    sortOrder: 37,
    labels: L("Bank customer / KYC", "Клиент банка / KYC", "Bank müştərisi / KYC"),
  },
  {
    fromKey: "industry_wholesale",
    toKey: "industry_logistics",
    kind: "OPS_HANDOFF",
    realizationStatus: "planned",
    sortOrder: 38,
    labels: L("Wholesale ↔ logistics dispatch", "Опт ↔ логистика", "Topdan ↔ logistika"),
  },
  {
    fromKey: "industry_retail",
    toKey: "industry_logistics",
    kind: "OPS_HANDOFF",
    realizationStatus: "planned",
    sortOrder: 39,
    labels: L("Retail ↔ logistics delivery", "Розница ↔ логистика", "Pərakəndə ↔ logistika"),
  },
  {
    fromKey: "industry_auto_service",
    toKey: "industry_retail",
    kind: "OPS_HANDOFF",
    realizationStatus: "planned",
    sortOrder: 40,
    labels: L("Parts transfer to retail", "Запчасти в розницу", "Ehtiyat hissələri pərakəndəyə"),
  },
  {
    fromKey: "industry_retail",
    toKey: "industry_auto_service",
    kind: "OPS_HANDOFF",
    realizationStatus: "planned",
    sortOrder: 41,
    labels: L("Warehouse parts to work order", "Склад → наряд", "Anbar → iş sifarişi"),
  },
  {
    fromKey: "industry_auto_service",
    toKey: "industry_hotel_pms",
    kind: "FOLIO_POST",
    realizationStatus: "planned",
    sortOrder: 42,
    labels: L("Room folio charge", "Начисление в фолио", "Otaq folio ödənişi"),
  },
  {
    fromKey: "platform_workforce",
    toKey: ARCHITECTURE_STAFF_PROVISION_REMAINDER_KEY,
    kind: "STAFF_PROVISION",
    realizationStatus: "planned",
    sortOrder: 43,
    labels: L(
      "Provisioning to logistics, auto, wholesale, CRM",
      "Провижининг в логистику, авто, опт, CRM",
      "Logistika, auto, topdan, CRM təminatı",
    ),
  },
  {
    fromKey: ARCHITECTURE_ANALYTICS_EMITTERS_KEY,
    toKey: "platform_datahub",
    kind: "ANALYTICS",
    realizationStatus: "planned",
    sortOrder: 44,
    labels: L("Analytics facts to Data HUB", "Аналитика в Data HUB", "Analitika Data HUB-a"),
  },
  {
    fromKey: "platform_datahub",
    toKey: ARCHITECTURE_REFERENCE_CONSUMERS_KEY,
    kind: "REFERENCE_DATA",
    realizationStatus: "planned",
    sortOrder: 45,
    labels: L("Gateway reference feeds", "Справочники через Gateway", "Gateway arayışları"),
  },
  {
    fromKey: "industry_construction",
    toKey: "finance_core",
    kind: "REVENUE_EVENT",
    realizationStatus: "planned",
    sortOrder: 46,
    labels: L("Invoice from progress act", "Счёт из акта", "Aktdan hesab-faktura"),
  },
  {
    fromKey: "industry_clinic",
    toKey: "platform_datahub",
    kind: "REFERENCE_DATA",
    realizationStatus: "planned",
    sortOrder: 47,
    labels: L("Clinical reference catalogs", "Справочники клиники", "Klinika arayışları"),
  },
  {
    fromKey: ARCHITECTURE_READ_STATUS_CLIENT_KEY,
    toKey: ARCHITECTURE_READ_STATUS_PROVIDER_KEY,
    kind: "READ_STATUS",
    realizationStatus: "planned",
    sortOrder: 48,
    labels: L("Read-only status queries", "Чтение статуса", "Status oxuma"),
  },
];

async function findArchitectureEdge(
  prisma: PrismaClient,
  edge: Pick<ArchitectureEdgeSeed, "fromKey" | "toKey" | "kind">,
) {
  return prisma.siteArchitectureEdge.findUnique({
    where: {
      fromKey_toKey_kind: {
        fromKey: edge.fromKey,
        toKey: edge.toKey,
        kind: edge.kind,
      },
    },
  });
}

/** Idempotent canonical edge seed (preserves manual rows: autoManaged=false). */
export async function seedSiteArchitectureEdges(
  prisma: PrismaClient,
): Promise<void> {
  for (const edge of SITE_ARCHITECTURE_EDGE_SEEDS) {
    const existing = await findArchitectureEdge(prisma, edge);
    if (existing && !existing.autoManaged) continue;
    if (existing) continue;
    await prisma.siteArchitectureEdge.create({
      data: {
        fromKey: edge.fromKey,
        toKey: edge.toKey,
        kind: edge.kind,
        realizationStatus: edge.realizationStatus,
        labels: edge.labels,
        visibility: edge.visibility ?? "VISIBLE",
        sortOrder: edge.sortOrder,
        autoManaged: false,
      },
    });
  }
}

type AutoEdgeSpec = {
  fromKey: string;
  toKey: string;
  kind: SiteArchitectureEdgeKind;
  realizationStatus: SiteArchitectureRealizationStatus;
  sortOrder: number;
  labels: LocaleMap;
};

async function ensureAutoEdge(
  prisma: PrismaClient,
  edge: AutoEdgeSpec,
): Promise<void> {
  const existing = await findArchitectureEdge(prisma, edge);
  if (existing) return;
  await prisma.siteArchitectureEdge.create({
    data: {
      ...edge,
      visibility: "VISIBLE",
      autoManaged: true,
    },
  });
}

/**
 * New industry satellites: desired REVENUE_EVENT → finance_core and planned CRM party sync.
 */
export async function ensureAutoArchitectureEdges(
  prisma: PrismaClient,
): Promise<void> {
  const industryRows = await prisma.satellite.findMany({
    where: { key: { startsWith: "industry_" } },
    select: { key: true },
    orderBy: { key: "asc" },
  });

  for (const { key } of industryRows) {
    await ensureAutoEdge(prisma, {
      fromKey: key,
      toKey: "finance_core",
      kind: "REVENUE_EVENT",
      realizationStatus: "live",
      sortOrder: 900,
      labels: L("Revenue events to ERA Core", "Выручка в ERA Core", "Gəlir ERA Core-a"),
    });
    if (key === "industry_crm") continue;
    await ensureAutoEdge(prisma, {
      fromKey: key,
      toKey: "industry_crm",
      kind: "CRM_PARTY",
      realizationStatus: "planned",
      sortOrder: 901,
      labels: L("Party sync to CRM", "Синхронизация party в CRM", "CRM party sinxronu"),
    });
  }
}