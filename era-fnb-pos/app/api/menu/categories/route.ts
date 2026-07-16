import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET() {
  try {
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
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const body = createSchema.parse(await request.json());
    let outlet = await prisma.outlet.findUnique({
      where: { code: body.outletCode },
    });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: { code: body.outletCode, name: body.outletCode },
      });
    }

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
