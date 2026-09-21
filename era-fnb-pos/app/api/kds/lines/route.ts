import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.KDS_BUMP);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_kitchen_kds");
    const lines = await prisma.ticketLine.findMany({
      where: { kitchenStatus: { in: ["NEW", "FIRED", "IN_PREP"] } },
      include: { ticket: { include: { table: true, outlet: true } } },
      orderBy: { ticket: { openedAt: "asc" } },
      take: 100,
    });
    return NextResponse.json(lines);
  } catch (err) {
    return handleRouteError(err);
  }
}
