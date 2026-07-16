import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { recordMenuItemPrice } from "@/lib/menu-price-history";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dailyOnly = url.searchParams.get("dailyOnly") === "true";
    const outletCode = url.searchParams.get("outletCode") ?? "RESTAURANT";
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const categories = await prisma.menuCategory.findMany({
      include: {
        items: {
          where: includeInactive ? undefined : { active: true },
          orderBy: { name: "asc" },
        },
      },
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
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  plu: z.string().min(1),
  name: z.string().min(1),
  priceAzn: z.number().nonnegative(),
  active: z.boolean().optional(),
  recipeSku: z.string().min(1).nullable().optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
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

    let category =
      body.categoryId != null
        ? await prisma.menuCategory.findUnique({ where: { id: body.categoryId } })
        : null;
    if (!category && body.categoryName) {
      category = await prisma.menuCategory.findFirst({
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
    }
    if (!category) {
      return jsonError("categoryId or categoryName required", 400);
    }

    const imageUrl =
      body.imageUrl === "" || body.imageUrl === undefined
        ? null
        : body.imageUrl;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          categoryId: category!.id,
          plu: body.plu,
          name: body.name,
          priceAzn: body.priceAzn,
          active: body.active ?? true,
          recipeSku: body.recipeSku ?? null,
          imageUrl,
        },
      });
      await recordMenuItemPrice(tx, created.id, body.priceAzn, {
        createdBy: session?.login ?? session?.sub ?? null,
      });
      return created;
    });

    return jsonOk(item, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
