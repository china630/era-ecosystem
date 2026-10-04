export function isReportTotalLabel(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^(total|sum|subtotal|grand(\s+total)?|итого|сумма|cəmi|cemi|yekun)$/i.test(value.trim());
}

export function isReportTotalRow(row: readonly unknown[]): boolean {
  return row.some(isReportTotalLabel);
}

export function reportCellAlign(value: unknown): 'left' | 'right' | 'center' {
  if (typeof value === 'number') return 'right';
  if (typeof value !== 'string') return 'left';
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^\d{2}\.\d{2}\.\d{4}$/.test(text)) return 'center';
  if (/^-?\d[\d\s.,]*%?$/.test(text)) return 'right';
  return 'left';
}
