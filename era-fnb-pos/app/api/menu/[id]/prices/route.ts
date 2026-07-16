import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(_request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const { id } = await params;
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) return jsonError("Menu item not found", 404);

    const prices = await prisma.menuItemPrice.findMany({
      where: { menuItemId: id },
      orderBy: { effectiveFrom: "desc" },
    });
    return jsonOk({
      menuItemId: id,
      plu: item.plu,
      name: item.name,
      currentPriceAzn: item.priceAzn,
      prices,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
