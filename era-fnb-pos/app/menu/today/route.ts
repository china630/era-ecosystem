import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { NextResponse } from "next/server";
import { enterFnbRequestTenant } from "@/lib/api-utils";
import { findOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";

/** Read-only today's board. Logged-in session picks KAFE (or the outlet query). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const outletParam = url.searchParams.get("outlet");
  const dateYmd = todayBakuYmd();
  const boardDate = bakuCivilUtcDate(dateYmd);
  const empty = { outletCode: outletParam, date: dateYmd, items: [] as unknown[] };

  try {
    await enterFnbRequestTenant();
    const outlet = await findOpsOutlet(outletParam);
    if (!outlet) return NextResponse.json(empty);

    const entries = await prisma.dailyMenuEntry.findMany({
      where: { outletId: outlet.id, boardDate },
      include: { menuItem: true },
      orderBy: [{ sortOrder: "asc" }],
    });

    return NextResponse.json({
      outletCode: outlet.code,
      date: dateYmd,
      items: entries.map((e) => ({
        plu: e.menuItem.plu,
        name: e.menuItem.name,
        priceAzn: Number(e.menuItem.priceAzn),
        featured: e.isFeatured,
      })),
    });
  } catch {
    return NextResponse.json(empty);
  }
}
