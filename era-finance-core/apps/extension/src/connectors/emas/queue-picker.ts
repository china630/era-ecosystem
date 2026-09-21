/** Queue rows safe for extension prefill (READY = has FIN + salary > 0). */
export type EmasQueuePickerItem = {
  employeeId: string;
  displayName: string | null;
  positionTitle?: string;
  finPending?: boolean;
  salaryGrossAzn?: string;
  finCode?: string | null;
};

export function queueItemsForPrefill(
  items: EmasQueuePickerItem[],
): EmasQueuePickerItem[] {
  return items.filter((row) => {
    if (row.finPending) return false;
    if (!row.finCode) return false;
    const sal = Number(row.salaryGrossAzn ?? 0);
    if (!Number.isFinite(sal) || sal <= 0) return false;
    return true;
  });
}
