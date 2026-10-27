import { headers } from 'next/headers';
import {
  scheduleHttpMutationAuditFromHeaders,
  type SatelliteAuditWriter,
} from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

/** Product-specific Layer A skips (in addition to kit baseline). */
export const HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES = [
  '/api/auth/session/refresh-permissions',
] as const;

const writeAudit: SatelliteAuditWriter = async (row) => {
  await prisma.satelliteAuditLog.create({ data: row });
};

/** Hook from `jsonOk` after a successful response is built. */
export function scheduleHotelHttpMutationAudit(statusCode: number): void {
  void (async () => {
    try {
      const h = await headers();
      scheduleHttpMutationAuditFromHeaders(h, statusCode, {
        write: writeAudit,
        extraExemptPrefixes: HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES,
      });
    } catch (err) {
      console.error('[hotel-mutation-audit] schedule failed', err);
    }
  })();
}
