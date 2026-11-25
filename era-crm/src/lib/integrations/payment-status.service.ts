/**
 * E5 — payment status on lead (display only; PSP stays orch/Finance).
 */
import { prisma } from "@/lib/prisma";

export type LeadPaymentView = {
  paymentLink?: string;
  paymentStatus?: string;
};

export function readPaymentFromCustomJson(customJson?: string | null): LeadPaymentView {
  try {
    const o = JSON.parse(customJson || "{}") as Record<string, unknown>;
    return {
      paymentLink:
        typeof o._paymentLink === "string" ? o._paymentLink : undefined,
      paymentStatus:
        typeof o._paymentStatus === "string" ? o._paymentStatus : undefined,
    };
  } catch {
    return {};
  }
}

/** Mark paid when Finance/orch notifies CRM (manual ops or future event). */
export async function setLeadPaymentStatus(
  organizationId: string,
  leadId: string,
  status: string,
  paymentLink?: string,
): Promise<LeadPaymentView> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
  });
  if (!lead) throw new Error("lead not found");
  const prev = JSON.parse(lead.customJson || "{}") as Record<string, unknown>;
  const next = {
    ...prev,
    _paymentStatus: status,
    ...(paymentLink ? { _paymentLink: paymentLink } : {}),
  };
  await prisma.lead.update({
    where: { id: leadId },
    data: { customJson: JSON.stringify(next) },
  });
  return readPaymentFromCustomJson(JSON.stringify(next));
}
