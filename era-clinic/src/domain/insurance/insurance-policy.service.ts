import { prisma } from "@/lib/prisma";
import type { ClinicPayerKind } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";

export async function listInsurancePolicies(patientRefId?: string) {
  const organizationId = requestOrganizationId();
  return prisma.patientInsurancePolicy.findMany({
    where: {
      organizationId,
      ...(patientRefId ? { patientRefId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createInsurancePolicy(input: {
  patientRefId: string;
  payerKind: ClinicPayerKind;
  payerCounterpartyId?: string;
  policyNumber: string;
  validFrom?: string;
  validTo?: string;
  programCode?: string;
}) {
  const organizationId = requestOrganizationId();
  return prisma.patientInsurancePolicy.create({
    data: {
      organizationId,
      patientRefId: input.patientRefId,
      payerKind: input.payerKind,
      payerCounterpartyId: input.payerCounterpartyId,
      policyNumber: input.policyNumber.trim(),
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validTo: input.validTo ? new Date(input.validTo) : null,
      programCode: input.programCode?.trim() || null,
    },
  });
}