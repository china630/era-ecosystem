import { TENDER_SEED_ROWS, type TenderRow } from "@era/contracts";
import type { CatalogOption } from "../ui/catalog-field";

/** Phase 4 interim: seed tenders until Finance org enablement API ships. */
export function tenderCatalogOptions(locale: "az" | "ru" | "en" = "en"): CatalogOption[] {
  return TENDER_SEED_ROWS.filter((t) => t.active).map((t: TenderRow) => ({
    value: t.code,
    label: locale === "az" ? t.nameAz : locale === "ru" ? t.nameRu : t.nameEn,
  }));
}

export function hotelTenderOptions(locale: "az" | "ru" | "en" = "en"): CatalogOption[] {
  return tenderCatalogOptions(locale).filter((o) =>
    ["CASH", "CARD", "COMPANY_ACCOUNT", "LOYALTY_POINTS", "DEPOSIT"].includes(o.value),
  );
}

export function clinicTenderOptions(locale: "az" | "ru" | "en" = "en"): CatalogOption[] {
  return tenderCatalogOptions(locale).filter((o) =>
    ["CASH", "CARD", "TRANSFER"].includes(o.value),
  );
}
