import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "json";
    const apiKey = req.headers.get("x-api-key") ?? url.searchParams.get("apiKey");
    const expected = process.env.WHOLESALE_EDI_API_KEY ?? "wholesale-edi-demo";
    if (apiKey !== expected) {
      return jsonError("Invalid API key", 401);
    }

    const orders = await prisma.b2BOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { pickList: { include: { lines: true } } },
    });

    if (format === "csv") {
      const header = "orderId,status,createdAt,lineSku,qty";
      const rows = orders.flatMap((o) =>
        (o.pickList?.lines ?? []).map(
          (l) =>
            `${o.id},${o.status},${o.createdAt.toISOString()},${l.skuCode},${l.qtyOrdered}`,
        ),
      );
      const csv = [header, ...rows].join("\n");
      return new Response(csv, {
        headers: { "Content-Type": "text/csv" },
      });
    }

    return jsonOk({ orders });
  } catch (err) {
    return handleRouteError(err);
  }
}
