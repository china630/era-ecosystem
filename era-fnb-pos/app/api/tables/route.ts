import { z } from "zod";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET() {
  try {
    const tables = await prisma.posTable.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        seats: true,
        zone: true,
        status: true,
        outletId: true,
      },
    });
    return jsonOk(tables);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  code: z.string().min(1),
  name: z.string().min(1),
  seats: z.number().int().positive().optional(),
  zone: z.string().optional(),
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
        data: {
          code: body.outletCode,
          name: body.outletCode,
        },
      });
    }
    const table = await prisma.posTable.create({
      data: {
        outletId: outlet.id,
        code: body.code,
        name: body.name,
        seats: body.seats ?? 4,
        zone: body.zone,
      },
    });
    return jsonOk(table, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
