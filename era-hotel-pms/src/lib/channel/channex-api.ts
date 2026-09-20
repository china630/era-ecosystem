import { fetchChannexClientConfig, type ChannexClientConfig } from '@era/satellite-kit';

export const CHANNEX_AVAIL_CALLS_PER_MIN = 10;
export const CHANNEX_RESTRICTION_CALLS_PER_MIN = 10;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isChannexUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function channexApiRoot(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export function isChannexProductionBase(apiBase: string): boolean {
  const host = apiBase.toLowerCase();
  return host.includes('app.channex.io') || host.includes('://channex.io');
}

export type ChannexHttpResult = {
  ok: boolean;
  status: number;
  json: unknown;
  text: string;
  retryAfterMs?: number;
};

export async function channexRequest(
  client: Pick<ChannexClientConfig, 'apiBase' | 'apiKey'>,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<ChannexHttpResult> {
  const url = `${channexApiRoot(client.apiBase)}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'user-api-key': client.apiKey ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const retryAfter = res.headers.get('retry-after');
  const retryAfterMs = retryAfter
    ? Number(retryAfter) * (Number(retryAfter) < 100 ? 1000 : 1)
    : undefined;
  return { ok: res.ok, status: res.status, json, text, retryAfterMs };
}

export async function loadChannexClient() {
  return fetchChannexClientConfig();
}

export async function fetchBookingRevision(client: ChannexClientConfig, revisionId: string) {
  return channexRequest(client, 'GET', `/booking_revisions/${revisionId}`);
}

export async function ackBookingRevision(client: ChannexClientConfig, revisionId: string) {
  return channexRequest(client, 'POST', `/booking_revisions/${revisionId}/ack`);
}

export async function postAvailability(
  client: ChannexClientConfig,
  values: Array<Record<string, unknown>>,
) {
  return channexRequest(client, 'POST', '/availability', { values });
}

export async function postRestrictions(
  client: ChannexClientConfig,
  values: Array<Record<string, unknown>>,
) {
  return channexRequest(client, 'POST', '/restrictions', { values });
}

export type AriAllowReason =
  | 'ok'
  | 'no_partner_key'
  | 'not_certified'
  | 'staging_org_blocked_from_production';

export function allowAriForBinding(input: {
  live: boolean;
  client: ChannexClientConfig;
}): AriAllowReason {
  if (!input.client.hasApiKey || !input.client.apiKey) return 'no_partner_key';
  const prod = isChannexProductionBase(input.client.apiBase);
  if (input.live) {
    if (prod && !input.client.pmsCertified) return 'not_certified';
    return 'ok';
  }
  if (prod) return 'staging_org_blocked_from_production';
  return 'ok';
}
