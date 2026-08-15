"use client";

import { useTranslations } from "next-intl";
import type { ListPaginationFooterLabels } from "@era/satellite-kit/ui";

/** i18n labels for ListPaginationFooter / EraDataGrid. */
export function useListPaginationLabels(): ListPaginationFooterLabels {
  const t = useTranslations("common");
  return {
    rowsPerPage: t("rowsPerPage"),
    pageOf: t("pageOf"),
    prev: t("prev"),
    next: t("next"),
  };
}
