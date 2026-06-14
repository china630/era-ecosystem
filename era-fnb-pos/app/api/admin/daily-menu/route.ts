import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

function parseBoardDate(raw: string | null): Date {
  const d = raw ? new Date(raw) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const outletCode = url.searchParams.get("outletCode") ?? "RESTAURANT";
    const date = parseBoardDate(url.searchParams.get("date"));

    const outlet = await prisma.outlet.findUnique({ where: { code: outletCode } });
    if (!outlet) return jsonOk({ date: date.toISOString().slice(0, 10), entries: [] });

    const entries = await prisma.dailyMenuEntry.findMany({
      where: { outletId: outlet.id, boardDate: date },
      include: { menuItem: { include: { category: true } } },
      orderBy: [{ sortOrder: "asc" }, { menuItem: { name: "asc" } }],
    });

    return jsonOk({
      outletCode,
      date: date.toISOString().slice(0, 10),
      entries: entries.map((e) => ({
        id: e.id,
        menuItemId: e.menuItemId,
        sortOrder: e.sortOrder,
        isFeatured: e.isFeatured,
        plu: e.menuItem.plu,
        name: e.menuItem.name,
        priceAzn: e.menuItem.priceAzn,
        category: e.menuItem.category.name,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const putSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  date: z.string().optional(),
  menuItemIds: z.array(z.string()).min(1),
});

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const body = putSchema.parse(await request.json());
    const date = parseBoardDate(body.date ?? null);

    let outlet = await prisma.outlet.findUnique({ where: { code: body.outletCode } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: { code: body.outletCode, name: body.outletCode },
      });
    }

    await prisma.$transaction([
      prisma.dailyMenuEntry.deleteMany({ where: { outletId: outlet.id, boardDate: date } }),
      prisma.dailyMenuEntry.createMany({
        data: body.menuItemIds.map((menuItemId, idx) => ({
          outletId: outlet!.id,
          menuItemId,
          boardDate: date,
          sortOrder: idx,
        })),
      }),
    ]);

    return jsonOk({ ok: true, count: body.menuItemIds.length });
  } catch (err) {
    return handleRouteError(err);
  }
}

const copySchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  fromDate: z.string(),
  toDate: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const body = copySchema.parse(await request.json());
    const from = parseBoardDate(body.fromDate);
    const to = parseBoardDate(body.toDate);

    const outlet = await prisma.outlet.findUnique({ where: { code: body.outletCode } });
    if (!outlet) return jsonError("Outlet not found", 404);

    const source = await prisma.dailyMenuEntry.findMany({
      where: { outletId: outlet.id, boardDate: from },
    });
    if (source.length === 0) return jsonError("No entries on source date", 400);

    await prisma.$transaction([
      prisma.dailyMenuEntry.deleteMany({ where: { outletId: outlet.id, boardDate: to } }),
      prisma.dailyMenuEntry.createMany({
        data: source.map((e) => ({
          outletId: outlet.id,
          menuItemId: e.menuItemId,
          boardDate: to,
          sortOrder: e.sortOrder,
          isFeatured: e.isFeatured,
        })),
      }),
    ]);

    return jsonOk({ ok: true, copied: source.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
