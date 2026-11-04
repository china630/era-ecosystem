import { TENDER_SEED_ROWS, type TenderRow } from "@era/contracts";
import type { CatalogOption } from "../ui/catalog-field";
import {
  listPaymentMethodsForSatellite,
  paymentMethodsSynced,
} from "../integration/payment-method-catalog";

/**
 * Fallback seed tenders. Prefer org Sync catalog via listPaymentMethodsForSatellite
 * on the server, or GET /api/payment-methods from the desk UI.
 */
export function tenderCatalogOptions(locale: "az" | "ru" | "en" = "en"): CatalogOption[] {
  return TENDER_SEED_ROWS.filter((t) => t.active).map((t: TenderRow) => ({
    value: t.code,
    label: locale === "az" ? t.nameAz : locale === "ru" ? t.nameRu : t.nameEn,
  }));
}

export function hotelTenderOptions(
  locale: "az" | "ru" | "en" = "en",
  organizationId?: string,
): CatalogOption[] {
  if (organizationId && paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: "hotel",
    }).map((row) => ({
      value: row.code,
      label: locale === "az" ? row.nameAz : locale === "ru" ? row.nameRu : row.nameEn,
    }));
  }
  return tenderCatalogOptions(locale).filter((o) =>
    ["CASH", "CARD", "EPOINT", "COMPANY_ACCOUNT", "LOYALTY_POINTS", "DEPOSIT"].includes(o.value),
  );
}

export function clinicTenderOptions(
  locale: "az" | "ru" | "en" = "en",
  organizationId?: string,
): CatalogOption[] {
  if (organizationId && paymentMethodsSynced(organizationId)) {
    return listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: "clinic",
    }).map((row) => ({
      value: row.code,
      label: locale === "az" ? row.nameAz : locale === "ru" ? row.nameRu : row.nameEn,
    }));
  }
  return tenderCatalogOptions(locale).filter((o) =>
    ["CASH", "CARD", "TRANSFER"].includes(o.value),
  );
}
