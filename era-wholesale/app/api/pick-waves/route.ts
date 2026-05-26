import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  waveCode: z.string().min(1),
  orderNumbers: z.array(z.string()).min(1),
});

export async function GET() {
  try {
    const lists = await prisma.pickList.findMany({
      where: { waveCode: { not: null } },
      include: { order: true, lines: true },
      orderBy: { waveCode: "asc" },
    });
    const byWave = new Map<string, typeof lists>();
    for (const pl of lists) {
      const key = pl.waveCode ?? "UNASSIGNED";
      const arr = byWave.get(key) ?? [];
      arr.push(pl);
      byWave.set(key, arr);
    }
    const waves = [...byWave.entries()].map(([waveCode, pickLists]) => ({
      waveCode,
      pickListCount: pickLists.length,
      pickLists,
    }));
    return jsonOk(waves);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const results = [];
    for (const orderNumber of body.orderNumbers) {
      const order = await prisma.b2BOrder.findUnique({ where: { orderNumber } });
      if (!order) continue;
      const pl = await prisma.pickList.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          waveCode: body.waveCode,
          lines: {
            create: [{ skuCode: "WAVE-PLACEHOLDER", qtyOrdered: 1 }],
          },
        },
        update: { waveCode: body.waveCode },
      });
      results.push(pl);
    }
    return jsonOk({ waveCode: body.waveCode, pickLists: results }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
