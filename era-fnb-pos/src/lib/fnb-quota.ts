import { FnbQuotaError } from "@/lib/fnb-module-gate";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

const LIMITS = {
  ticketCreatePerMin: 120,
  publicMenuPerMin: 600,
};

function hit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now - cur.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }
  cur.count += 1;
  if (cur.count > limit) {
    throw new FnbQuotaError(`SHARED pool quota exceeded (${key})`);
  }
}

export function assertTicketCreateQuota(organizationId: string): void {
  hit(`ticket:${organizationId}`, LIMITS.ticketCreatePerMin);
}

export function assertPublicMenuQuota(ip: string): void {
  hit(`qr:${ip || "unknown"}`, LIMITS.publicMenuPerMin);
}

export function assertPinLoginQuota(ip: string): void {
  hit(`pin:${ip || "unknown"}`, 20);
}
