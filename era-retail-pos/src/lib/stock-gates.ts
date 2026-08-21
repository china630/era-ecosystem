/** Pure stock / write-off gates (AC-RET-STOCK negative paths). */

export function stockWriteOffDenied(
  lines: Array<{ sku: string; qty: number }> | null | undefined,
): string | null {
  if (!lines || lines.length === 0) return "lines required";
  return null;
}
