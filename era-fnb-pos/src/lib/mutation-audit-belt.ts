import { headers } from "next/headers";
import {
  scheduleHttpMutationAuditFromHeaders,
  type SatelliteAuditWriter,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const FNB_MUTATION_AUDIT_EXEMPT_PREFIXES = [
  "/api/auth/session/refresh-permissions",
] as const;

const writeAudit: SatelliteAuditWriter = async (row) => {
  await prisma.satelliteAuditLog.create({ data: row });
};

export function scheduleFnbHttpMutationAudit(statusCode: number): void {
  void (async () => {
    try {
      const h = await headers();
      scheduleHttpMutationAuditFromHeaders(h, statusCode, {
        write: writeAudit,
        extraExemptPrefixes: FNB_MUTATION_AUDIT_EXEMPT_PREFIXES,
      });
    } catch (err) {
      console.error("[fnb-mutation-audit] schedule failed", err);
    }
  })();
}
