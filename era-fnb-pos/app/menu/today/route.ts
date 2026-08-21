import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public read-only today's menu for QR guest link (no auth). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const outletCode = url.searchParams.get("outlet") ?? "RESTAURANT";
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const outlet = await prisma.outlet.findFirst({ where: { code: outletCode } });
  if (!outlet) {
    return NextResponse.json({ outletCode, date: date.toISOString().slice(0, 10), items: [] });
  }

  const entries = await prisma.dailyMenuEntry.findMany({
    where: { outletId: outlet.id, boardDate: date },
    include: { menuItem: true },
    orderBy: [{ sortOrder: "asc" }],
  });

  return NextResponse.json({
    outletCode,
    date: date.toISOString().slice(0, 10),
    items: entries.map((e) => ({
      plu: e.menuItem.plu,
      name: e.menuItem.name,
      priceAzn: Number(e.menuItem.priceAzn),
      featured: e.isFeatured,
    })),
  });
}
