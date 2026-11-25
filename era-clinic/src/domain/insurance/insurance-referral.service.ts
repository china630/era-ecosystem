import { prisma } from "@/lib/prisma";
import type { InsuranceReferralSource } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import { validateManualReferral } from "@/integration/its/manual-gateway";
import { addBakuDays } from "@/lib/baku-day";

export async function listInsuranceReferrals(patientRefId?: string) {
  const organizationId = requestOrganizationId();
  return prisma.insuranceReferral.findMany({
    where: {
      organizationId,
      ...(patientRefId ? { patientRefId } : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
}

export async function registerInsuranceReferral(input: {
  patientRefId: string;
  policyId?: string;
  source: InsuranceReferralSource;
  referralCode: string;
  issuedAt?: string;
  expiresAt?: string;
  allowedServiceCodes?: string[];
}) {
  const organizationId = requestOrganizationId();
  const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
  const issuedYmd = issuedAt.toISOString().slice(0, 10);
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(`${addBakuDays(issuedYmd, 10)}T23:59:59.999+04:00`);

  const check = validateManualReferral({
    referralCode: input.referralCode,
    issuedAt,
    expiresAt,
  });
  if (!check.ok) {
    return { kind: "rejected" as const, code: check.code };
  }

  const row = await prisma.insuranceReferral.create({
    data: {
      organizationId,
      patientRefId: input.patientRefId,
      policyId: input.policyId,
      source: input.source,
      referralCode: input.referralCode.trim(),
      issuedAt,
      expiresAt,
      allowedServiceCodes: input.allowedServiceCodes ?? check.allowedServiceCodes,
      status: "NEW",
    },
  });
  return { kind: "ok" as const, referral: row };
}

export async function insuranceServicesReport(fromYmd: string, toYmd: string) {
  const organizationId = requestOrganizationId();
  const from = new Date(`${fromYmd}T00:00:00.000+04:00`);
  const to = new Date(`${toYmd}T23:59:59.999+04:00`);
  const visits = await prisma.visit.findMany({
    where: {
      organizationId,
      payerKind: { in: ["ITS", "DMS", "CORPORATE"] },
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      payerKind: true,
      amountNet: true,
      createdAt: true,
      patientRef: { select: { refCode: true, fullName: true } },
      referral: { select: { referralCode: true, source: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return {
    from: fromYmd,
    to: toYmd,
    items: visits.map((v) => ({
      visitId: v.id,
      payerKind: v.payerKind,
      amountNet: Number(v.amountNet),
      patientRefCode: v.patientRef.refCode,
      patientName: v.patientRef.fullName,
      referralCode: v.referral?.referralCode ?? null,
      referralSource: v.referral?.source ?? null,
      at: v.createdAt.toISOString(),
    })),
  };
}