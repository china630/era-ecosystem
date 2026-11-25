import { prisma } from "@/lib/prisma";
import type { SelectionPackageStatus, WarrantyCaseStatus } from "@prisma/client";

export async function createSelectionItem(
  packageId: string,
  body: { code: string; label: string; amount?: number; status?: string },
) {
  const pkg = await prisma.selectionPackage.findFirst({ where: { id: packageId } });
  if (!pkg) return { error: "Package not found" as const, status: 404 as const };
  const row = await prisma.selectionItem.create({
    data: {
      packageId,
      code: body.code.trim(),
      label: body.label.trim(),
      amount: body.amount != null ? body.amount : null,
      status: body.status?.trim() || "PENDING",
    },
  });
  return { row };
}

export async function transitionSelectionPackage(
  packageId: string,
  status: SelectionPackageStatus,
) {
  const pkg = await prisma.selectionPackage.findFirst({ where: { id: packageId } });
  if (!pkg) return { error: "Package not found" as const, status: 404 as const };
  const row = await prisma.selectionPackage.update({
    where: { id: packageId },
    data: { status },
  });
  return { row };
}

export async function createWarrantyCase(
  leadId: string,
  body: {
    subject: string;
    partyRef?: string;
    constructionProjectId?: string;
    notes?: string;
  },
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found" as const, status: 404 as const };
  const row = await prisma.warrantyCase.create({
    data: {
      leadId,
      subject: body.subject.trim(),
      partyRef: body.partyRef?.trim() || null,
      constructionProjectId: body.constructionProjectId?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });
  return { row };
}

export async function transitionWarrantyCase(
  caseId: string,
  status: WarrantyCaseStatus,
) {
  const existing = await prisma.warrantyCase.findFirst({ where: { id: caseId } });
  if (!existing) return { error: "Case not found" as const, status: 404 as const };
  const row = await prisma.warrantyCase.update({
    where: { id: caseId },
    data: { status },
  });
  return { row };
}
