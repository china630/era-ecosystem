import { requestOrganizationId } from '@/lib/request-organization';

/** Ask Finance to queue a company or agency card. Does not create the card or a city ledger. */
export async function requestFinanceCardIfMissing(input: {
  voen?: string | null;
  name: string;
  partyKind: 'COMPANY' | 'AGENCY';
}): Promise<void> {
  const voen = input.voen?.trim() ?? '';
  if (!/^\d{10}$/.test(voen)) return;
  try {
  await queueFinanceCard(voen, input);
  } catch {
    return;
  }
}

async function queueFinanceCard(
  voen: string,
  input: { name: string; partyKind: 'COMPANY' | 'AGENCY' },
) {
  const financeBase = (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    process.env.NEXT_PUBLIC_FINANCE_WEB_URL ??
    ''
  )
    .replace(/\/$/, '')
    .trim();
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  const orgId = requestOrganizationId();
  if (!financeBase || !token || !orgId) return;
  await fetch(`${financeBase}/api/internal/v1/counterparties/card-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
    body: JSON.stringify({
      taxId: voen,
      name: input.name.trim() || voen,
      partyKind: input.partyKind,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}
