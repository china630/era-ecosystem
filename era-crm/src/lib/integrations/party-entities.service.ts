/**
 * P1-3 Contact / Company (M23) — CRM ops entities; MDM/Finance remain legal SoR.
 */
import { prisma } from "@/lib/prisma";

export async function listCompanies(organizationId: string) {
  return prisma.company.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { contacts: { take: 20 } },
  });
}

export async function createCompany(
  organizationId: string,
  data: { name: string; taxId?: string },
) {
  return prisma.company.create({
    data: {
      organizationId,
      name: data.name.trim(),
      taxId: data.taxId?.trim() || null,
    },
  });
}

export async function listContacts(organizationId: string, companyId?: string) {
  return prisma.contact.findMany({
    where: {
      organizationId,
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { company: true },
  });
}

export async function createContact(
  organizationId: string,
  data: {
    fullName: string;
    phone?: string;
    email?: string;
    companyId?: string;
    globalPersonId?: string;
  },
) {
  return prisma.contact.create({
    data: {
      organizationId,
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      companyId: data.companyId || null,
      globalPersonId: data.globalPersonId || null,
    },
  });
}

/** P1-7 Merge duplicate leads: rebind Visit/Activity/Conversation/Call/Task to survivor. */
export async function mergeLeads(input: {
  organizationId: string;
  survivorLeadId: string;
  duplicateLeadId: string;
}): Promise<{ ok: true; survivorLeadId: string }> {
  if (input.survivorLeadId === input.duplicateLeadId) {
    throw new Error("survivor and duplicate must differ");
  }
  const [survivor, dup] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: input.survivorLeadId, organizationId: input.organizationId },
    }),
    prisma.lead.findFirst({
      where: { id: input.duplicateLeadId, organizationId: input.organizationId },
    }),
  ]);
  if (!survivor || !dup) throw new Error("lead not found");

  await prisma.$transaction(async (tx) => {
    await tx.visit.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.activity.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.conversation.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.call.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.task.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.leadStageHistory.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.selectionPackage.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    await tx.warrantyCase.updateMany({
      where: { organizationId: input.organizationId, leadId: dup.id },
      data: { leadId: survivor.id },
    });
    // Prefer non-empty contact fields from duplicate.
    await tx.lead.update({
      where: { id: survivor.id },
      data: {
        contactPhone: survivor.contactPhone || dup.contactPhone,
        contactEmail: survivor.contactEmail || dup.contactEmail,
        companyName: survivor.companyName || dup.companyName,
        taxId: survivor.taxId || dup.taxId,
      },
    });
    await tx.activity.create({
      data: {
        organizationId: input.organizationId,
        leadId: survivor.id,
        type: "SYSTEM",
        payloadJson: JSON.stringify({
          action: "merge",
          fromLeadId: dup.id,
        }),
      },
    });
    await tx.lead.delete({ where: { id: dup.id } });
  });

  return { ok: true, survivorLeadId: survivor.id };
}
