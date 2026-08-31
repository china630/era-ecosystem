import type { SatelliteTransactionClient } from "@era/satellite-kit/tenancy";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { formatPatientRefCode } from "@/domain/patient/patient-ref-code";

type SeqClient = {
  tenant: Pick<typeof prisma.tenant, "findFirst" | "create" | "update">;
};

/**
 * Atomically allocate next clinic-native refCode (P-000001 …) for the request org.
 * Ensures a Tenant row exists for the organization.
 * Server-only: keep out of client bundles (do not import from `"use client"` pages).
 */
export async function allocatePatientRefCode(
  tx?: SeqClient | SatelliteTransactionClient,
  organizationId?: string,
): Promise<string> {
  const client = (tx ?? prisma) as SeqClient;
  const orgId = organizationId ?? requestOrganizationId();

  const existing = await client.tenant.findFirst({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const tenant =
    existing ??
    (await client.tenant.create({
      data: {
        organizationId: orgId,
        code: orgId.slice(0, 24) || "clinic",
        name: "Clinic",
        nextPatientSeq: 1,
      },
      select: { id: true },
    }));

  const updated = await client.tenant.update({
    where: { id: tenant.id },
    data: { nextPatientSeq: { increment: 1 } },
    select: { nextPatientSeq: true, organizationId: true },
  });
  if (updated.organizationId !== orgId) {
    throw new Error("Tenant organization mismatch while allocating patient refCode");
  }
  const seq = updated.nextPatientSeq - 1;
  if (seq < 1) {
    throw new Error("Failed to allocate patient refCode sequence");
  }
  return formatPatientRefCode(seq);
}
