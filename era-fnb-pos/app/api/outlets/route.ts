import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { OUTLET_LIST_READ } from "@/lib/auth/read-permission-sets";
import { recordMenuItemPrice } from "@/lib/menu-price-history";
import {
  defaultCapabilitiesForShape,
  OUTLET_SHAPE_HINTS,
  type OutletShapeHint,
} from "@/lib/outlet-capabilities";

const copySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  copyFromOutletId: z.string().optional(),
  publicSlug: z.string().min(2).max(64).optional(),
  shapeHint: z.enum(OUTLET_SHAPE_HINTS).optional(),
  capTill: z.boolean().optional(),
  capTables: z.boolean().optional(),
  capBuffetPlanner: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, OUTLET_LIST_READ);
    if (denied) return denied;
    const outlets = await prisma.outlet.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
    const selectedOutletId = await getSelectedOutletId();
    return jsonOk({ outlets, selectedOutletId });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return denied;
    const body = copySchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const code = body.code.trim().toUpperCase();
    if (code === "RESTAURANT") {
      return jsonError("Outlet code RESTAURANT is retired — use NAFTANI", 400);
    }

    const shape: OutletShapeHint = body.shapeHint ?? "restaurant";
    const caps = defaultCapabilitiesForShape(shape);
    if (body.capTill !== undefined) caps.till = body.capTill;
    if (body.capTables !== undefined) caps.tables = body.capTables;
    if (body.capBuffetPlanner !== undefined) caps.buffetPlanner = body.capBuffetPlanner;

    let source: {
      id: string;
      revenueCenterCode: string;
      financeWarehouseCode: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      website: string | null;
    } | null = null;
    if (body.copyFromOutletId) {
      source = await prisma.outlet.findFirst({
        where: { id: body.copyFromOutletId, organizationId, active: true },
        select: {
          id: true,
          revenueCenterCode: true,
          financeWarehouseCode: true,
          phone: true,
          email: true,
          address: true,
          website: true,
        },
      });
      if (!source) return jsonError("Source outlet not found", 404);
    }

    const created = await prisma.outlet.create({
      data: {
        organizationId,
        code,
        name: body.name.trim(),
        publicSlug: body.publicSlug ?? null,
        capTill: caps.till,
        capTables: caps.tables,
        capBuffetPlanner: caps.buffetPlanner,
        shapeHint: caps.shapeHint,
        ...(source
          ? {
              revenueCenterCode: source.revenueCenterCode,
              financeWarehouseCode: source.financeWarehouseCode,
              phone: source.phone,
              email: source.email,
              address: source.address,
              website: source.website,
            }
          : {}),
      },
    });

    if (source) {
      const cats = await prisma.menuCategory.findMany({
        where: { outletId: source.id },
        include: { items: true },
      });
      for (const cat of cats) {
        const nc = await prisma.menuCategory.create({
          data: {
            organizationId,
            outletId: created.id,
            name: cat.name,
            code: cat.code,
            revenueCode: cat.revenueCode,
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
              financeSku: item.financeSku,
              revenueCode: null,
              imageUrl: item.imageUrl,
            },
          });
          await recordMenuItemPrice(prisma, ni.id, Number(item.priceAzn), {
            reason: "branch-copy",
          });
        }
      }

      const halls = await prisma.posHall.findMany({
        where: { outletId: source.id },
        orderBy: { sortOrder: "asc" },
      });
      const hallIdMap = new Map<string, string>();
      for (const hall of halls) {
        const nh = await prisma.posHall.create({
          data: {
            organizationId,
            outletId: created.id,
            name: hall.name,
            sortOrder: hall.sortOrder,
          },
        });
        hallIdMap.set(hall.id, nh.id);
      }

      const tables = await prisma.posTable.findMany({
        where: { outletId: source.id },
        orderBy: { code: "asc" },
      });
      for (const table of tables) {
        await prisma.posTable.create({
          data: {
            organizationId,
            outletId: created.id,
            hallId: table.hallId ? hallIdMap.get(table.hallId) ?? null : null,
            code: table.code,
            name: table.name,
            seats: table.seats,
            zone: table.zone,
            status: "FREE",
            currentTicketId: null,
          },
        });
      }
    }

    return jsonOk(created, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError("Outlet code already exists", 409);
    }
    return handleRouteError(err);
  }
}
