import { z } from "zod";
import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TABLES } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_TABLES);
    if (denied) return denied;
    const outlet = await resolveOpsOutlet();
    const halls = await prisma.posHall.findMany({
      where: { outletId: outlet.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { tables: true } } },
    });
    return jsonOk(
      halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        sortOrder: hall.sortOrder,
        tableCount: hall._count.tables,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;
    const body = createSchema.parse(await request.json());
    const outlet = await resolveOpsOutlet();
    const taken = await prisma.posHall.findMany({
      where: { outletId: outlet.id },
      select: { name: true },
    });
    const key = body.name.toLocaleLowerCase();
    if (taken.some((row) => row.name.trim().toLocaleLowerCase() === key)) {
      return jsonOk({ error: "Hall already exists", code: "HALL_DUPLICATE" }, 409);
    }
    const last = await prisma.posHall.findFirst({
      where: { outletId: outlet.id },
      orderBy: { sortOrder: "desc" },
    });
    const hall = await prisma.posHall.create({
      data: {
        organizationId: requestOrganizationId(),
        outletId: outlet.id,
        name: body.name,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    return jsonOk(hall, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
