import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
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
        hallId: true,
        hall: { select: { id: true, name: true, sortOrder: true } },
        status: true,
        outletId: true,
        currentTicketId: true,
      },
    });
    const openTickets = await prisma.ticket.findMany({
      where: {
        status: { in: ["OPEN", "HELD"] },
        tableId: { not: null },
      },
      select: { id: true, tableId: true, totalAzn: true, openedAt: true },
    });
    const ticketIdByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.id]),
    );
    const totalByTicket = new Map(openTickets.map((row) => [row.id, Number(row.totalAzn)]));
    const openedByTicket = new Map(openTickets.map((row) => [row.id, row.openedAt.toISOString()]));
    const totalByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, Number(row.totalAzn)]),
    );
    const openedByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.openedAt.toISOString()]),
    );
    return jsonOk(
      tables.map((table) => ({
        ...table,
        currentTicketId: table.currentTicketId ?? ticketIdByTable.get(table.id) ?? null,
        status:
          table.status === "OCCUPIED" || table.currentTicketId || totalByTable.has(table.id)
            ? "OCCUPIED"
            : table.status,
        openTotalAzn:
          (table.currentTicketId ? totalByTicket.get(table.currentTicketId) : undefined) ??
          totalByTable.get(table.id) ??
          null,
        openedAt:
          (table.currentTicketId ? openedByTicket.get(table.currentTicketId) : undefined) ??
          openedByTable.get(table.id) ??
          null,
      })),
    );
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
  hallId: z.string().nullable().optional(),
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
    if (body.hallId) {
      const hall = await prisma.posHall.findFirst({ where: { id: body.hallId, outletId: outlet.id } });
      if (!hall) return jsonError("Hall not found", 404);
    }
    const table = await prisma.posTable.create({
      data: {
        organizationId,
        outletId: outlet.id,
        code: body.code,
        name: body.name,
        seats: body.seats ?? 4,
        zone: body.zone ?? null,
        hallId: body.hallId ?? null,
      },
    });
    return jsonOk(table, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
