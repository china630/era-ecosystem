import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SATELLITE_FB_SALE_COMPLETED } from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { shiftIdCovering } from "@/lib/open-shift";
import { assertFbRevenueChannel } from "@/lib/fb-finance-events";
import { enterRequestTenant } from "@/lib/request-organization";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  /** Hub always sends sourceOrgId — required for SHARED tenant enter before Prisma. */
  organizationId: z.string().min(1),
});

function verifyBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    if (!verifyBridge(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    enterRequestTenant(body.organizationId);

    const ticket = await prisma.ticket.findUnique({
      where: { id: body.sourceRef },
      include: { table: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
      return jsonOk({ ok: true, alreadyClosed: true });
    }

    const storedPendingIds = ticket.settlementPendingId?.trim() ?? "";
    if (storedPendingIds.startsWith("[")) {
      const parsed = JSON.parse(storedPendingIds) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const left = ids.filter((id) => id !== body.pendingId);
      if (left.length > 0) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { settlementPendingId: JSON.stringify(left) },
        });
        return jsonOk({ ok: true, waiting: left.length });
      }
    }

    // Fail-closed before CLOSE — hub settle completes money path (sale emit stays local-cashier only).
    await assertFbRevenueChannel(SATELLITE_FB_SALE_COMPLETED);

    const closedAt = new Date();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CLOSED",
        closedAt,
        shiftId: await shiftIdCovering(ticket.outletId, closedAt),
        settlementPendingId: body.pendingId,
        hubFiscalReceiptId: body.fiscalReceiptId ?? null,
      },
    });
    await releaseTableForTicket(ticket.id, ticket.tableId);

    return NextResponse.json({ ok: true, ticketId: ticket.id, status: "CLOSED" });
  } catch (err) {
    return handleRouteError(err);
  }
}
