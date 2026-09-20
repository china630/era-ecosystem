import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(_request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
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
