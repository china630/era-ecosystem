import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  clientId: z.string(),
  receipts: z.array(z.record(z.unknown())),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const rows = await Promise.all(
      body.receipts.map((payload) =>
        prisma.offlineReceiptQueue.create({
          data: {
            clientId: body.clientId,
            payloadJson: JSON.stringify(payload),
            status: "PENDING",
          },
        }),
      ),
    );
    return jsonOk({ queued: rows.length, ids: rows.map((r) => r.id) }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: Request) {
  try {
    const clientId = new URL(req.url).searchParams.get("clientId");
    const pending = await prisma.offlineReceiptQueue.findMany({
      where: { status: "PENDING", ...(clientId ? { clientId } : {}) },
      take: 50,
    });
    return jsonOk({ pending });
  } catch (err) {
    return handleRouteError(err);
  }
}
