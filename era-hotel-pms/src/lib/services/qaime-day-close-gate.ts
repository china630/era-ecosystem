import { requestOrganizationId } from '@/lib/request-organization';

export type QaimeDayGap = {
  id: string;
  number: string;
  counterpartyName: string;
};

export class QaimeDayCloseBlockedError extends Error {
  readonly status = 409;
  readonly code = 'QAIME_REQUIRED';
  readonly gaps: QaimeDayGap[];

  constructor(gaps: QaimeDayGap[]) {
    super('Night audit is waiting on e-qaimə numbers for registered invoices');
    this.name = 'QaimeDayCloseBlockedError';
    this.gaps = gaps;
  }
}

export class QaimeDayCloseUnreachableError extends Error {
  readonly status = 503;
  readonly code = 'QAIME_FINANCE_DOWN';

  constructor() {
    super('Finance did not answer the e-qaimə day check');
    this.name = 'QaimeDayCloseUnreachableError';
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function financeApiBase(): string {
  const configured = (process.env.ERA_FINANCE_API_URL ?? process.env.FINANCE_API_URL)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.ERA_IN_DOCKER === '1') return 'http://finance-core:4100';
  return 'http://127.0.0.1:4100';
}

export function assertQaimeDayClose(answer: { enabled: boolean; gaps: QaimeDayGap[] }): void {
  if (!answer.enabled) return;
  if (answer.gaps.length === 0) return;
  throw new QaimeDayCloseBlockedError(answer.gaps);
}

/** Ask Finance. A missing answer refuses the close so an enabled rule cannot be skipped. */
export async function fetchQaimeDayClose(
  businessDate: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ enabled: boolean; gaps: QaimeDayGap[] }> {
  const token = (process.env.FINANCE_SERVICE_TOKEN ?? process.env.SATELLITE_EVENT_SERVICE_TOKEN)?.trim();
  let organizationId = "";
  try {
    organizationId = requestOrganizationId();
  } catch {
    organizationId = "";
  }
  if (!organizationId || !token) throw new QaimeDayCloseUnreachableError();
  let res: Response;
  try {
    res = await fetchImpl(
      `${financeApiBase()}/api/internal/v1/qaime-day-close?date=${encodeURIComponent(businessDate)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': organizationId,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new QaimeDayCloseUnreachableError();
  }
  if (!res.ok) throw new QaimeDayCloseUnreachableError();
  const body = (await res.json()) as { enabled?: unknown; gaps?: unknown };
  const enabled = body.enabled === true;
  const gaps = Array.isArray(body.gaps)
    ? body.gaps.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        if (typeof item.id !== 'string' || typeof item.number !== 'string') return [];
        return [
          {
            id: item.id,
            number: item.number,
            counterpartyName: typeof item.counterpartyName === 'string' ? item.counterpartyName : '',
          },
        ];
      })
    : [];
  return { enabled, gaps };
}

export async function assertFinanceQaimeDayClose(businessDate: string): Promise<void> {
  const answer = await fetchQaimeDayClose(businessDate);
  assertQaimeDayClose(answer);
}
