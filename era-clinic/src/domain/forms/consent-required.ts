import { prisma } from "@/lib/prisma";

export const CONSENT_REQUIRED_CODE = "CONSENT_REQUIRED";

export type ConsentCheckInput = {
  organizationId: string;
  patientRefId: string;
  templateCode: string;
  appointmentId?: string;
};

export async function assertPatientConsentSigned(input: ConsentCheckInput): Promise<{
  ok: boolean;
  missing?: string[];
}> {
  const templates = await prisma.patientFormTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      active: true,
      consentRequired: true,
      ...(input.templateCode ? { code: input.templateCode } : {}),
    },
    select: { code: true },
  });
  if (templates.length === 0) return { ok: true };

  const signed = await prisma.patientFormResponse.findMany({
    where: {
      organizationId: input.organizationId,
      patientRefId: input.patientRefId,
      templateCode: { in: templates.map((t) => t.code) },
      signedAt: { not: null },
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
    },
    select: { templateCode: true },
  });
  const signedSet = new Set(signed.map((s) => s.templateCode));
  const missing = templates.map((t) => t.code).filter((code) => !signedSet.has(code));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}