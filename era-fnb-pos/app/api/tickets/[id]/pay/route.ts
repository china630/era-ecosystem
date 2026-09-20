import type { TicketLine } from "@prisma/client";
import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { dispatchFbSaleCompleted } from "@/lib/fb-finance-events";
import { dispatchStockConsumptionIfEnabled } from "@/lib/stock-consumption";
import {
  payBlockedReason,
  resolveTicketSettlement,
  shouldFiscalizeAtPos,
} from "@/lib/billing-router";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleRouteError } from "@/lib/api-utils";

const paySchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  amount: z.number().positive().optional(),
  delivery: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_PAY);
  if (denied) {
    if (denied.status === 401) return denied;
    return new Response(
      JSON.stringify({
        error: "Forbidden: insufficient permissions",
        code: "FNB_WAITER_NO_PAY",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const { id } = await params;
  const body = paySchema.parse(await request.json());

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { table: true, outlet: true, lines: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket is not open for payment" },
      { status: 400 },
    );
  }

  const amount = body.amount ?? Number(ticket.totalAzn);
  const organizationId = requestOrganizationId();

  const settlement = await resolveTicketSettlement(ticket);
  const payBlock = payBlockedReason(settlement);
  if (payBlock) {
    return NextResponse.json({ error: payBlock }, { status: 400 });
  }

  const { saleForSatelliteRouted, isFiscalPaymentMethod, isFiscalSkipped } =
    await import("@era/satellite-kit");

  let fiscal: {
    receiptId?: string | null;
    qrPayload?: string | null;
    driver?: string | null;
    skipped?: boolean;
    skipReason?: string;
  } = { skipped: true };
  if (isFiscalPaymentMethod(body.method) && shouldFiscalizeAtPos(settlement)) {
    const activeLines = ticket.lines.filter(
      (l: TicketLine) => l.kitchenStatus !== "VOID",
    );
    const openShift = await prisma.posShift.findFirst({
      where: { outletId: ticket.outletId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    const outcome = await saleForSatelliteRouted({
      documentRef: ticket.id,
      organizationId: organizationId || undefined,
      outletCode: ticket.outlet.code,
      fiscalDeviceId: body.fiscalDeviceId ?? openShift?.fiscalDeviceId ?? undefined,
      bankTerminalId: body.bankTerminalId ?? openShift?.bankTerminalId ?? undefined,
      shiftFiscalDeviceId: openShift?.fiscalDeviceId ?? undefined,
      shiftBankTerminalId: openShift?.bankTerminalId ?? undefined,
      lines: activeLines.map((l: TicketLine) => ({
        sku: l.menuItemId ?? undefined,
        name: l.description || l.menuItemId || "Item",
        qty: Number(l.qty),
        unitPrice: Number(l.unitPriceAzn),
      })),
      tenders: [{ method: body.method, amount }],
    });
    fiscal = isFiscalSkipped(outcome)
      ? {
          skipped: true,
          skipReason:
            "reason" in outcome ? String(outcome.reason) : "skipped",
        }
      : {
          receiptId: outcome.receiptId ?? null,
          qrPayload: outcome.qrPayload ?? null,
          driver: outcome.driver ?? null,
        };
  }

  await prisma.ticket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await releaseTableForTicket(id, ticket.tableId);

  let payUrl: string | undefined;
  if (organizationId) {
    const hooks = await runPlatformCommerceHooks({
      organizationId,
      portal: { entityType: "fb_ticket", entityId: ticket.id },
      payment: {
        amountAzn: amount,
        sourceEntityType: "fb_ticket",
        sourceEntityId: ticket.id,
        description: `Ticket ${ticket.id}`,
      },
      ...(body.delivery
        ? {
            delivery: {
              sourceEntityType: "fb_ticket",
              sourceEntityId: ticket.id,
              externalRef: ticket.id,
            },
          }
        : {}),
      loyalty: {
        code: `FB-TICKET-${ticket.id.slice(0, 8)}`,
        name: "FB ticket promotion",
        discountValue: 5,
        metadata: { ticketId: ticket.id },
      },
      ...(body.customHostname?.trim()
        ? {
            domain: {
              hostname: body.customHostname.trim(),
              metadata: { ticketId: ticket.id },
            },
          }
        : {}),
      ...(ticket.tableId
        ? {
            bookingSlot: {
              resourceKey: `fb-table-${ticket.tableId}`,
              resourceName: ticket.table?.name ?? `Table ${ticket.tableId}`,
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 7200_000).toISOString(),
              capacity: 1,
              metadata: { ticketId: ticket.id },
            },
          }
        : {}),
    });
    payUrl = hooks.payUrl;
  }

  void dispatchStockConsumptionIfEnabled(id, body.method, amount).catch(() => {
    // E8 optional; enabled via STOCK_CONSUMPTION_ENABLED
  });

  if (settlement === "LOCAL_CASHIER") {
    const receiptId = fiscal.receiptId?.trim() || `fb-ticket-${id}`;
    const lineCount = ticket.lines.filter((l: TicketLine) => l.kitchenStatus !== "VOID").length;
    void dispatchFbSaleCompleted({
      ticketId: id,
      outletId: ticket.outletId,
      outletCode: ticket.outlet.code,
      amountAzn: amount,
      paymentMethod: body.method,
      receiptId,
      lineCount,
    }).catch(() => {
      // Revenue event best-effort; ticket already closed
    });
  }

  await trySendPlatformNotification({
    templateKey: "fb.ticket.paid",
    channel: "EMAIL",
    messageClass: "TRANSACTIONAL",
    recipient: process.env.FB_NOTIFY_RECIPIENT?.trim() || ticket.id,
    sourceEntityType: "fb_ticket",
    sourceEntityId: ticket.id,
    body: `Ticket paid ${amount.toFixed(2)} AZN (${body.method})${payUrl ? ` — ${payUrl}` : ""}`,
    payload: { method: body.method, amount, payUrl, receiptId: fiscal.receiptId },
  });

  return NextResponse.json(
    {
      ticketId: id,
      method: body.method,
      amount,
      status: "PAID",
      fiscal: {
        receiptId: fiscal.receiptId,
        qrPayload: fiscal.qrPayload,
        driver: fiscal.driver,
      },
    },
    { status: 201 },
  );
  } catch (err) {
    return handleRouteError(err);
  }
}
