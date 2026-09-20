import { assertFnbEntitled, handleRouteError, jsonError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { OUTLET_LIST_READ } from "@/lib/auth/read-permission-sets";
import { recordMenuItemPrice } from "@/lib/menu-price-history";

const copySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  copyFromOutletId: z.string().optional(),
  publicSlug: z.string().min(2).max(64).optional(),
});

export async function GET(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessAnyPermission(session, OUTLET_LIST_READ);
  if (denied) return denied;
  const outlets = await prisma.outlet.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
  const selectedOutletId = await getSelectedOutletId();
  return NextResponse.json({ outlets, selectedOutletId });
}

export async function POST(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return denied;
    const body = copySchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const created = await prisma.outlet.create({
      data: {
        organizationId,
        code: body.code,
        name: body.name,
        publicSlug: body.publicSlug ?? null,
      },
    });
    if (body.copyFromOutletId) {
      const cats = await prisma.menuCategory.findMany({
        where: { outletId: body.copyFromOutletId },
        include: { items: true },
      });
      for (const cat of cats) {
        const nc = await prisma.menuCategory.create({
          data: {
            organizationId,
            outletId: created.id,
            name: cat.name,
            sortOrder: cat.sortOrder,
          },
        });
        for (const item of cat.items) {
          const ni = await prisma.menuItem.create({
            data: {
              organizationId,
              categoryId: nc.id,
              plu: item.plu,
              name: item.name,
              priceAzn: item.priceAzn,
              active: item.active,
              recipeSku: item.recipeSku,
              imageUrl: item.imageUrl,
            },
          });
          await recordMenuItemPrice(prisma, ni.id, Number(item.priceAzn), {
            reason: "branch-copy",
          });
        }
      }
    }
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
