import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public read-only today's menu for QR guest link (no auth). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const outletCode = url.searchParams.get("outlet") ?? "RESTAURANT";
  const dateYmd = todayBakuYmd();
  const boardDate = bakuCivilUtcDate(dateYmd);

  const outlet = await prisma.outlet.findFirst({ where: { code: outletCode } });
  if (!outlet) {
    return NextResponse.json({ outletCode, date: dateYmd, items: [] });
  }

  const entries = await prisma.dailyMenuEntry.findMany({
    where: { outletId: outlet.id, boardDate },
    include: { menuItem: true },
    orderBy: [{ sortOrder: "asc" }],
  });

  return NextResponse.json({
    outletCode,
    date: dateYmd,
    items: entries.map((e) => ({
      plu: e.menuItem.plu,
      name: e.menuItem.name,
      priceAzn: Number(e.menuItem.priceAzn),
      featured: e.isFeatured,
    })),
  });
}
