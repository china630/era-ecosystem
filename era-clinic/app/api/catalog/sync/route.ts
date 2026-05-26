import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      description: z.string(),
      amount: z.number().nonnegative(),
    }),
  ),
});

/** Stub: Finance price list push or manual sync. */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    for (const item of body.items) {
      await prisma.serviceCatalogCache.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          description: item.description,
          amount: item.amount,
        },
        update: {
          description: item.description,
          amount: item.amount,
          syncedAt: new Date(),
        },
      });
    }
    const count = await prisma.serviceCatalogCache.count();
    return jsonOk({ synced: body.items.length, total: count });
  } catch (err) {
    return handleRouteError(err);
  }
}
