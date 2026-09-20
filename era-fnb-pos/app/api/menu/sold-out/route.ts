import { z } from "zod";
import { assertFnbEntitled, handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_SOLD_OUT } from "@/lib/auth/read-permission-sets";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  outletId: z.string().optional(),
  soldOut: z.boolean(),
});

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_SOLD_OUT);
    if (denied) return denied;
    const outletId =
      new URL(request.url).searchParams.get("outletId") ??
      (await getSelectedOutletId());
    const rows = await prisma.menuItemSoldOut.findMany({
      where: {
        organizationId: requestOrganizationId(),
        ...(outletId ? { outletId } : {}),
      },
    });
    return jsonOk({ soldOut: rows.filter((r) => r.soldOut) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_SOLD_OUT);
    if (denied) return denied;
    const body = bodySchema.parse(await request.json());
    const outletId = body.outletId ?? (await getSelectedOutletId());
    if (!outletId) return jsonError("outletId required", 400);
    const organizationId = requestOrganizationId();
    const row = await prisma.menuItemSoldOut.upsert({
      where: {
        organizationId_menuItemId_outletId: {
          organizationId,
          menuItemId: body.menuItemId,
          outletId,
        },
      },
      create: {
        organizationId,
        menuItemId: body.menuItemId,
        outletId,
        soldOut: body.soldOut,
      },
      update: { soldOut: body.soldOut },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
