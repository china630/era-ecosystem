export function financeWebBaseUrl(): string {
  return (
    process.env.FINANCE_WEB_URL ??
    process.env.NEXT_PUBLIC_FINANCE_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export function buildFinanceTeamUrl(organizationId?: string): string {
  const base = financeWebBaseUrl();
  const q = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : "";
  return `${base}/settings/team${q}`;
}

export function buildFinanceBillingUrl(organizationId?: string): string {
  const base = financeWebBaseUrl();
  const q = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : "";
  return `${base}/cp${q}`;
}
