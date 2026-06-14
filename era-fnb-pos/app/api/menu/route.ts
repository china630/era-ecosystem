import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dailyOnly = url.searchParams.get("dailyOnly") === "true";
    const outletCode = url.searchParams.get("outletCode") ?? "RESTAURANT";

    const categories = await prisma.menuCategory.findMany({
      include: { items: { where: { active: true }, orderBy: { name: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    if (!dailyOnly) {
      return jsonOk(categories);
    }

    const outlet = await prisma.outlet.findUnique({ where: { code: outletCode } });
    if (!outlet) return jsonOk(categories);

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const boardIds = new Set(
      (
        await prisma.dailyMenuEntry.findMany({
          where: { outletId: outlet.id, boardDate: date },
          select: { menuItemId: true },
        })
      ).map((e) => e.menuItemId),
    );

    if (boardIds.size === 0) return jsonOk(categories);

    const filtered = categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((i) => boardIds.has(i.id)),
      }))
      .filter((cat) => cat.items.length > 0);

    return jsonOk(filtered);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  categoryName: z.string().min(1),
  plu: z.string().min(1),
  name: z.string().min(1),
  priceAzn: z.number().nonnegative(),
  active: z.boolean().optional(),
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

    let category = await prisma.menuCategory.findFirst({
      where: { outletId: outlet.id, name: body.categoryName },
    });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          outletId: outlet.id,
          name: body.categoryName,
          sortOrder: 99,
        },
      });
    }

    const item = await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        plu: body.plu,
        name: body.name,
        priceAzn: body.priceAzn,
        active: body.active ?? true,
      },
    });

    return jsonOk(item, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
