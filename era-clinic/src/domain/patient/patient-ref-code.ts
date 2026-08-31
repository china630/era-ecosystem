import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export type PatientNameParts = {
  givenName: string;
  surname: string;
  fatherName?: string | null;
};

/** Denormalized display + search string: Ad [Ata] Soyad. */
export function composeFullName(parts: PatientNameParts): string {
  const given = parts.givenName?.trim() ?? "";
  const father = parts.fatherName?.trim() ?? "";
  const surname = parts.surname?.trim() ?? "";
  return [given, father, surname].filter(Boolean).join(" ").trim();
}

export function formatPatientRefCode(seq: number): string {
  return `P-${String(seq).padStart(6, "0")}`;
}

export function isLegacyExternalPatientRefCode(refCode: string): boolean {
  const c = refCode.trim();
  return (
    /^wo[-:]patient[-:]/i.test(c) ||
    /^WALKIN-/i.test(c) ||
    /^HOTEL-/i.test(c) ||
    /^MDM-/i.test(c)
  );
}

export function isClinicPatientRefCode(refCode: string): boolean {
  return /^P-\d{6,}$/i.test(refCode.trim());
}

type SeqClient = {
  tenant: {
    findFirst: typeof prisma.tenant.findFirst;
    create: typeof prisma.tenant.create;
    update: typeof prisma.tenant.update;
  };
};

/**
 * Atomically allocate next clinic-native refCode (P-000001 …) for the request org.
 * Ensures a Tenant row exists for the organization.
 * Uses Prisma increment (atomic UPDATE) so satellite raw-SQL tenant filter is not required.
 */
export async function allocatePatientRefCode(
  tx?: Prisma.TransactionClient | SeqClient,
  organizationId?: string,
): Promise<string> {
  const client = (tx ?? prisma) as SeqClient;
  const orgId = organizationId ?? requestOrganizationId();

  let tenant = await client.tenant.findFirst({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!tenant) {
    tenant = await client.tenant.create({
      data: {
        organizationId: orgId,
        code: orgId.slice(0, 24) || "clinic",
        name: "Clinic",
        nextPatientSeq: 1,
      },
      select: { id: true },
    });
  }

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

/** Map legacy display codes back to cutover externalRef when possible. */
export function legacyRefCodeToExternalRef(refCode: string): string | null {
  const c = refCode.trim();
  const m = c.match(/^wo[-:]patient[-:](\d+)$/i);
  if (m) return `wo:patient:${m[1]}`;
  if (/^wo:patient:/i.test(c)) return c.toLowerCase().startsWith("wo:") ? c : null;
  return null;
}
