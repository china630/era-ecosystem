import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { getSatelliteSession } from "@/lib/session";

const bodySchema = z.object({ tableId: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_MOVE);
    if (denied) return denied;
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const ticket = await prisma.ticket.findFirst({ where: { id, organizationId } });
    if (!ticket || !["OPEN", "HELD"].includes(ticket.status)) {
      return jsonError("Open ticket required", 400);
    }
    const table = await prisma.posTable.findFirst({
      where: { id: body.tableId, outletId: ticket.outletId },
    });
    if (!table) return jsonError("Table is not on this outlet", 404);
    if (table.currentTicketId && table.currentTicketId !== id) {
      return jsonError("Table already has an open check", 409);
    }
    await prisma.$transaction([
      prisma.posTable.updateMany({
        where: { currentTicketId: id },
        data: { currentTicketId: null, status: "FREE" },
      }),
      prisma.ticket.update({ where: { id }, data: { tableId: table.id } }),
      prisma.posTable.update({
        where: { id: table.id },
        data: { currentTicketId: id, status: "OCCUPIED" },
      }),
    ]);
    await recordFbAudit({ userId: session?.sub, request }, "Ticket", id, "MOVE_TABLE", {
      fromTableId: ticket.tableId,
      toTableId: table.id,
    });
    return jsonOk({ ticketId: id, tableId: table.id });
  } catch (err) {
    return handleRouteError(err);
  }
}
