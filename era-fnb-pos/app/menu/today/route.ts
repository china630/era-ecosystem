import { IndustryModuleInactiveError } from "@era/satellite-kit";
import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { NextResponse } from "next/server";
import { findOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { getSatelliteSession } from "@/lib/session";
import { handleRouteError } from "@/lib/api-utils";

/** Read-only today's board. No session or a missing outlet returns an empty board. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const outletParam = url.searchParams.get("outlet");
  const dateYmd = todayBakuYmd();
  const boardDate = bakuCivilUtcDate(dateYmd);
  const empty = { outletCode: outletParam, date: dateYmd, items: [] as unknown[] };

  try {
    if (!(await getSatelliteSession())) return NextResponse.json(empty);
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
  } catch (err) {
    if (err instanceof IndustryModuleInactiveError) return handleRouteError(err);
    return NextResponse.json(empty);
  }
}
