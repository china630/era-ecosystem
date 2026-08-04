/**
 * Cross-satellite Tender (payment method) contract — ADR managed-lists-vs-enums A0/A3.
 *
 * SoR: Finance org prefs own the catalog + enablement.
 * Satellites consume the enabled subset (FO, cashier, POS); store tender `code` on ops rows.
 * Full HTTP wiring is Phase 4 — types only here.
 */

import { z } from "zod";

/** Stable tender codes (seed set; tenants may add custom codes later). */
export const TENDER_SEED_CODES = [
  "CASH",
  "CARD",
  "COMPANY_ACCOUNT",
  "LOYALTY_POINTS",
  "DEPOSIT",
  "TRANSFER",
] as const;

export type TenderSeedCode = (typeof TENDER_SEED_CODES)[number];

/** Any tender code (seed or tenant-extended). */
export type TenderCode = string;

export const tenderMetaSchema = z
  .object({
    /** Hint for fiscal / KKM tender mapping */
    fiscalHint: z.string().optional(),
    /** Optional GL / revenue posting hint */
    glHint: z.string().optional(),
    /** Hotel folio PaymentMethod legacy alias when bridging */
    hotelLegacyEnum: z.string().optional(),
  })
  .strict();

export type TenderMeta = z.infer<typeof tenderMetaSchema>;

export const tenderRowSchema = z.object({
  code: z.string().min(1).max(64),
  nameAz: z.string().min(1),
  nameRu: z.string().min(1),
  nameEn: z.string().min(1),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  /** Platform/system seed row — code immutable, labels editable */
  systemKey: z.string().optional(),
  meta: tenderMetaSchema.optional(),
});

export type TenderRow = z.infer<typeof tenderRowSchema>;

/** Org-level enablement of a tender code for satellite consumption. */
export const tenderOrgEnablementSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1),
  enabled: z.boolean(),
  sortOrder: z.number().int().optional(),
});

export type TenderOrgEnablement = z.infer<typeof tenderOrgEnablementSchema>;

export const tenderCatalogResponseSchema = z.object({
  tenders: z.array(tenderRowSchema),
  enabledCodes: z.array(z.string()).optional(),
});

export type TenderCatalogResponse = z.infer<typeof tenderCatalogResponseSchema>;

/** Default seed rows for bootstrap (Finance SoR). */
export const TENDER_SEED_ROWS: TenderRow[] = [
  {
    code: "CASH",
    nameAz: "Nağd",
    nameRu: "Наличные",
    nameEn: "Cash",
    active: true,
    sortOrder: 10,
    systemKey: "CASH",
    meta: { hotelLegacyEnum: "CASH", fiscalHint: "CASH" },
  },
  {
    code: "CARD",
    nameAz: "Kart",
    nameRu: "Карта",
    nameEn: "Card",
    active: true,
    sortOrder: 20,
    systemKey: "CARD",
    meta: { hotelLegacyEnum: "CARD", fiscalHint: "CARD" },
  },
  {
    code: "COMPANY_ACCOUNT",
    nameAz: "Şirkət hesabı",
    nameRu: "Счёт компании",
    nameEn: "Company account",
    active: true,
    sortOrder: 30,
    systemKey: "COMPANY_ACCOUNT",
    meta: { hotelLegacyEnum: "COMPANY_ACCOUNT" },
  },
  {
    code: "LOYALTY_POINTS",
    nameAz: "Bonus ballar",
    nameRu: "Бонусные баллы",
    nameEn: "Loyalty points",
    active: true,
    sortOrder: 40,
    systemKey: "LOYALTY_POINTS",
    meta: { hotelLegacyEnum: "LOYALTY_POINTS" },
  },
  {
    code: "DEPOSIT",
    nameAz: "Depozit",
    nameRu: "Депозит",
    nameEn: "Deposit",
    active: true,
    sortOrder: 50,
    systemKey: "DEPOSIT",
    meta: { hotelLegacyEnum: "DEPOSIT" },
  },
  {
    code: "TRANSFER",
    nameAz: "Köçürmə",
    nameRu: "Перевод",
    nameEn: "Bank transfer",
    active: true,
    sortOrder: 60,
    systemKey: "TRANSFER",
    meta: { fiscalHint: "TRANSFER" },
  },
];
