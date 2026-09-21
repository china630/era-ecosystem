import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_MENU);
    if (denied) return denied;
    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { items: true } },
      },
    });
    return jsonOk(categories);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const body = createSchema.parse(await request.json());
    const outlet = await ensureOutletByCode(body.outletCode);

    const existing = await prisma.menuCategory.findFirst({
      where: { outletId: outlet.id, name: body.name },
    });
    if (existing) return jsonError("Category already exists", 409);

    const maxSort = await prisma.menuCategory.aggregate({
      where: { outletId: outlet.id },
      _max: { sortOrder: true },
    });

    const category = await prisma.menuCategory.create({
      data: {
        outletId: outlet.id,
        name: body.name,
        sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    return jsonOk(category, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
