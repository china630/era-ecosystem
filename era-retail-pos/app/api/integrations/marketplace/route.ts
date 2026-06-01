import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  channel: z.enum(["umico", "kaspi", "other"]).default("other"),
  externalRef: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const secret = req.headers.get("x-marketplace-secret");
    const expected = process.env.MARKETPLACE_WEBHOOK_SECRET ?? "marketplace-dev";
    if (secret !== expected) {
      return handleRouteError(new Error("Unauthorized"));
    }
    const row = await prisma.marketplaceWebhookEvent.create({
      data: {
        channel: body.channel,
        externalRef: body.externalRef,
        payloadJson: JSON.stringify(body.payload ?? {}),
        processedAt: new Date(),
      },
    });
    return jsonOk({ eventId: row.id, channel: body.channel }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
