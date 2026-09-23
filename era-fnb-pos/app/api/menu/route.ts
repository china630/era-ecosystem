import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { recordMenuItemPrice } from "@/lib/menu-price-history";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";

export async function GET(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_MENU);
    if (denied) return denied;
    const url = new URL(request.url);
    const dailyOnly = url.searchParams.get("dailyOnly") === "true";
    const outletCode = url.searchParams.get("outletCode") ?? "RESTAURANT";
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    // Inactive catalog rows are admin-only (menu matrix).
    if (
      includeInactive &&
      !(
        session &&
        sessionHasFnbPermission(
          {
            login: session.login,
            email: session.email,
            role: session.role,
            permissions: session.permissions,
            isOwner: session.isOwner,
            pin: session.pin,
          },
          PERMISSIONS.MENU_MANAGE,
        )
      )
    ) {
      return jsonError("Forbidden: includeInactive requires api:menu.manage", 403);
    }

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

    const outlet = await prisma.outlet.findFirst({ where: { code: outletCode } });
    if (!outlet) return jsonOk(categories);

    const boardDate = bakuCivilUtcDate(todayBakuYmd());
    const boardIds = new Set(
      (
        await prisma.dailyMenuEntry.findMany({
          where: { outletId: outlet.id, boardDate },
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
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const body = createSchema.parse(await request.json());
    const outlet = await ensureOutletByCode(body.outletCode);

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
