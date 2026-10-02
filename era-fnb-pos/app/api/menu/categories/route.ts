import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";
import { categoryCodeFromName } from "@/lib/business-day";

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

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  name: z.string().min(1),
  code: codeSchema.optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const body = createSchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const outlet = await resolveOpsOutlet(body.outletCode);

    const existing = await prisma.menuCategory.findFirst({
      where: { outletId: outlet.id, name: body.name },
    });
    if (existing) return jsonError("Category already exists", 409);

    const maxSort = await prisma.menuCategory.aggregate({
      where: { outletId: outlet.id },
      _max: { sortOrder: true },
    });
    const sortOrder = body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1;
    const code = (body.code ?? categoryCodeFromName(body.name, `C${sortOrder}`)).toUpperCase();
    const codeTaken = await prisma.menuCategory.findFirst({
      where: { outletId: outlet.id, code },
    });
    if (codeTaken) return jsonError("Category code already exists", 409);

    const category = await prisma.menuCategory.create({
      data: {
        organizationId,
        outletId: outlet.id,
        name: body.name,
        code,
        sortOrder,
      },
    });
    return jsonOk(category, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
