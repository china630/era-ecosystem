import { z } from "zod";
import { handleRouteError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TABLES } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_TABLES);
    if (denied) return denied;
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
        currentTicketId: true,
      },
    });
    return jsonOk(tables);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  seats: z.number().int().positive().optional(),
  zone: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;

    const body = createSchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const outlet = await resolveOpsOutlet(body.outletCode);
    const table = await prisma.posTable.create({
      data: {
        organizationId,
        outletId: outlet.id,
        code: body.code,
        name: body.name,
        seats: body.seats ?? 4,
        zone: body.zone ?? null,
      },
    });
    return jsonOk(table, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
