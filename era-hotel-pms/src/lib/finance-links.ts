/** Deep links from hotel operational screens into era-finance-core web. */

export type FinanceDeepLinkTarget =
  | 'salesInvoices'
  | 'counterparties'
  | 'inventory'
  | 'purchases';

const PATHS: Record<FinanceDeepLinkTarget, string> = {
  salesInvoices: '/sales/invoices',
  counterparties: '/crm/counterparties',
  inventory: '/inventory',
  purchases: '/purchases',
};

export function financeWebBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function financeDeepLink(target: FinanceDeepLinkTarget): string | null {
  const base = financeWebBaseUrl();
  if (!base) return null;
  return `${base}${PATHS[target]}`;
}

export function isFinanceDeepLinkConfigured(): boolean {
  return financeWebBaseUrl() !== null;
}
