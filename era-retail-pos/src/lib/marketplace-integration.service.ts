import { prisma } from "@/lib/prisma";

export async function createMarketplaceWebhookEvent(data: {
  channel: string;
  externalRef: string;
  payloadJson: string;
}) {
  return prisma.marketplaceWebhookEvent.create({
    data: {
      channel: data.channel,
      externalRef: data.externalRef,
      payloadJson: data.payloadJson,
      processedAt: new Date(),
    },
  });
}
