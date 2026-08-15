"use client";

import { EraDataGrid, type EraDataGridProps } from "@era/satellite-kit/ui";
import { useListPaginationLabels } from "@/hooks/useListPaginationLabels";

/** EraDataGrid with hotel i18n pagination labels (DESIGN.md list footer). */
export function HotelDataGrid<T extends Record<string, unknown>>(
  props: Omit<EraDataGridProps<T>, "paginationLabels">,
) {
  const paginationLabels = useListPaginationLabels();
  return <EraDataGrid<T> {...props} paginationLabels={paginationLabels} />;
}
