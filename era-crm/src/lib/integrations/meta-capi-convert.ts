/**
 * Fire Meta Conversions API on lead WON when an enabled `meta_capi` connection exists.
 * Best-effort: convert never fails on CAPI errors.
 */
import { createHttpClient, metaCapiSendEvent } from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";

export async function fireMetaCapiOnWon(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId: lead.organizationId,
      providerKey: "meta_capi",
      enabled: true,
    },
  });
  if (!connection) return;
  const secrets = resolveSecrets(connection);
  const ctx = {
    connectionId: connection.id,
    organizationId: connection.organizationId,
    config: JSON.parse(connection.configJson || "{}") as Record<string, unknown>,
    secrets,
    webhookUrl: "",
    webhookSecret: "",
    http: createHttpClient(),
    log: console,
  };
  try {
    await metaCapiSendEvent(ctx, {
      eventName: "Purchase",
      emails: lead.contactEmail ? [lead.contactEmail] : [],
      phones: lead.contactPhone ? [lead.contactPhone] : [],
      value: lead.estimatedAmount != null ? Number(lead.estimatedAmount) : undefined,
      currency: "AZN",
    });
  } catch (err) {
    console.warn("[meta-capi] convert fire failed", err);
  }
}
