import { NextResponse } from "next/server";
import { prisma, prismaBare } from "@/lib/prisma";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { assertPublicMenuQuota } from "@/lib/fnb-quota";
import { enterRequestTenant } from "@/lib/request-organization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    assertPublicMenuQuota(ip);
    const { slug } = await params;
    const outlet = await prismaBare.outlet.findFirst({
      where: { publicSlug: slug, active: true },
    });
    if (!outlet) return jsonError("Menu not found", 404);
    enterRequestTenant(outlet.organizationId);
    await requireFnbSubmodule("fnb_qr_menu", outlet.organizationId);

    const sold = await prisma.menuItemSoldOut.findMany({
      where: { organizationId: outlet.organizationId, outletId: outlet.id, soldOut: true },
      select: { menuItemId: true },
    });
    const soldIds = new Set(sold.map((s) => s.menuItemId));

    const categories = await prisma.menuCategory.findMany({
      where: { outletId: outlet.id },
      include: {
        items: { where: { active: true }, orderBy: { name: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return jsonOk({
      outlet: { name: outlet.name, code: outlet.code },
      orderEnabled: false,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items
          .filter((i) => !soldIds.has(i.id))
          .map((i) => ({
            id: i.id,
            name: i.name,
            priceAzn: i.priceAzn,
            imageUrl: i.imageUrl,
          })),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Guest ordering is not enabled on QR menu", code: "QR_READ_ONLY" },
    { status: 405 },
  );
}
