import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export async function listPatientFormTemplates(includeInactive = false) {
  const organizationId = requestOrganizationId();
  return prisma.patientFormTemplate.findMany({
    where: {
      organizationId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: { code: "asc" },
  });
}

export async function createPatientFormTemplate(input: {
  code: string;
  titleEn: string;
  titleRu: string;
  titleAz: string;
  sectionsJson: string;
  consentRequired?: boolean;
}) {
  const organizationId = requestOrganizationId();
  return prisma.patientFormTemplate.create({
    data: {
      organizationId,
      code: input.code.trim().toUpperCase(),
      titleEn: input.titleEn,
      titleRu: input.titleRu,
      titleAz: input.titleAz,
      sectionsJson: input.sectionsJson,
      consentRequired: input.consentRequired ?? false,
    },
  });
}

export async function submitPatientFormResponse(input: {
  templateCode: string;
  patientRefId: string;
  appointmentId?: string;
  answersJson: string;
  signed?: boolean;
}) {
  const organizationId = requestOrganizationId();
  return prisma.patientFormResponse.create({
    data: {
      organizationId,
      templateCode: input.templateCode.trim().toUpperCase(),
      patientRefId: input.patientRefId,
      appointmentId: input.appointmentId,
      answersJson: input.answersJson,
      signedAt: input.signed ? new Date() : null,
      signatureKind: "SIMPLE",
    },
  });
}