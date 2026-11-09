import type { TicketLine } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { daySeqMap, releaseTableForTicket } from "@/lib/ticket-helpers";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  assertFbRevenueChannel,
  dispatchFbSaleCompleted,
} from "@/lib/fb-finance-events";
import { SATELLITE_FB_SALE_COMPLETED } from "@era/contracts";
import { dispatchStockConsumptionIfEnabled } from "@/lib/stock-consumption";
import {
  payBlockedReason,
  resolveTicketSettlement,
  shouldFiscalizeAtPos,
} from "@/lib/billing-router";
import { getSatelliteSession, sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { requireOpenShift } from "@/lib/open-shift";
import {
  outletToPrintOverlay,
  resolveFnbPrintContacts,
} from "@/lib/org-print-contacts";
import { recordFbAudit } from "@/lib/satellite-audit";

const paySchema = z.object({
  method: z.string().min(1).max(64),
  amount: z.number().positive().optional(),
  cashTendered: z.number().nonnegative().optional(),
  delivery: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  limitHolderId: z.string().min(1).max(64).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const session = await getSatelliteSession();
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
  const { assertFnbPaymentMethodAllowed } = await import('@/lib/org-payment-methods');
  const hallTender = body.method === "LIMIT" || body.method === "IKRAM";
  if (!hallTender) assertFnbPaymentMethodAllowed(body.method);

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

  const organizationId = requestOrganizationId();
  if (body.method === "LIMIT" && (!session || !sessionHasFnbPermission(session, PERMISSIONS.TICKETS_LIMIT))) {
    return NextResponse.json({ error: "Limit tender is not granted", code: "FNB_NO_LIMIT" }, { status: 403 });
  }
  if (body.method === "IKRAM" && (!session || !sessionHasFnbPermission(session, PERMISSIONS.TICKETS_IKRAM))) {
    return NextResponse.json({ error: "Compliment tender is not granted", code: "FNB_NO_IKRAM" }, { status: 403 });
  }
  if (hallTender && !ticket.outlet.hallMode) {
    return NextResponse.json({ error: "Hall tenders require hall mode on the outlet" }, { status: 409 });
  }
  const liveLines = ticket.lines.filter((l: TicketLine) => l.kitchenStatus !== "VOID");
  const due = Number(ticket.totalAzn);
  const amount = body.method === "IKRAM" ? 0 : (body.amount ?? due);
  let cashTendered: number | null = null;
  let changeAzn: number | null = null;
  if (body.method === "CASH") {
    cashTendered = body.cashTendered ?? due;
    if (cashTendered + 0.001 < due) {
      return NextResponse.json({ error: "Cash tendered is less than the check" }, { status: 400 });
    }
    changeAzn = Math.round((cashTendered - due) * 100) / 100;
  }
  if (liveLines.length === 0 || (body.method !== "IKRAM" && amount <= 0)) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }
  let limitBalanceAfter: number | null = null;
  let limitHolderName: string | null = null;
  if (body.method === "LIMIT") {
    if (!body.limitHolderId) {
      return NextResponse.json({ error: "Limit holder is required" }, { status: 400 });
    }
    const holder = await prisma.fnbLimitHolder.findFirst({
      where: { id: body.limitHolderId, organizationId, active: true },
    });
    if (!holder) return NextResponse.json({ error: "Limit holder not found" }, { status: 404 });
    limitHolderName = holder.displayName;
    const ceiling = Number(holder.ceilingAzn);
    const used = Number(holder.usedAzn);
    if (used + due > ceiling + 0.001) {
      return NextResponse.json(
        { error: "Limit ceiling exceeded", availableAzn: Math.round((ceiling - used) * 100) / 100 },
        { status: 409 },
      );
    }
    limitBalanceAfter = Math.round((ceiling - used - due) * 100) / 100;
  }
  const openShift = await requireOpenShift(ticket.outletId);

  const settlement = await resolveTicketSettlement(ticket);
  const payBlock = payBlockedReason(settlement);
  if (payBlock) {
    return NextResponse.json({ error: payBlock }, { status: 400 });
  }

  // Fail-closed before CLOSE: fire-and-forget dispatch after pay cannot roll back.
  if (settlement === "LOCAL_CASHIER") {
    await assertFbRevenueChannel(SATELLITE_FB_SALE_COMPLETED);
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

  if (body.method === "LIMIT" && body.limitHolderId) {
    const taken = await prisma.$executeRaw`
      UPDATE "fnb_limit_holders"
      SET "used_azn" = "used_azn" + ${due}, "updated_at" = NOW()
      WHERE "id" = ${body.limitHolderId}
        AND "organization_id" = ${organizationId}
        AND "active" = true
        AND "used_azn" + ${due} <= "ceiling_azn"
    `;
    if (taken !== 1) {
      return NextResponse.json({ error: "Limit ceiling exceeded" }, { status: 409 });
    }
  }
  await prisma.ticket.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      paymentMethod: body.method,
      tenderRoute: body.method,
      cardTerminalLabel: body.method === "CARD" ? body.bankTerminalId ?? null : null,
      limitHolderId: body.method === "LIMIT" ? body.limitHolderId ?? null : null,
      limitBalanceAfter,
      cashTenderedAzn: cashTendered,
      changeAzn,
      shiftId: openShift.id,
      closedByName: sessionActorName(session),
    },
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

  if (body.method !== "IKRAM") {
    void dispatchStockConsumptionIfEnabled(id, body.method, amount).catch(() => {
      // E8 optional; enabled via STOCK_CONSUMPTION_ENABLED
    });
  }

  if (settlement === "LOCAL_CASHIER" && body.method !== "IKRAM") {
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

  const printChrome = resolveFnbPrintContacts(
    outletToPrintOverlay(ticket.outlet),
  );

  await recordFbAudit(
    { userId: session?.sub, request },
    "Ticket",
    id,
    "PAY",
    {
      method: body.method,
      amount,
      cashTendered,
      changeAzn,
      settlement,
      shiftId: openShift.id,
      fiscalReceiptId: fiscal.receiptId ?? null,
      skippedFiscal: Boolean(fiscal.skipped),
    },
  );

  return jsonOk(
    {
      ticketId: id,
      method: body.method,
      amount,
      cashTendered,
      changeAzn,
      status: "PAID",
      fiscal: {
        receiptId: fiscal.receiptId,
        qrPayload: fiscal.qrPayload,
        driver: fiscal.driver,
      },
      /** Org profile + outlet overlay for guest check / KKM stub header. */
      printChrome,
      slip: {
        copies: 2,
        kind: body.method,
        ticketId: id,
        dayNo: (await daySeqMap(ticket.organizationId)).get(id) ?? null,
        outletName: ticket.outlet.name,
        table: ticket.table?.name ?? ticket.table?.code ?? null,
        guestName: ticket.guestName,
        room: ticket.roomNumberLabel,
        waiter: ticket.waiterLabel,
        at: new Date().toISOString(),
        total: body.method === "IKRAM" ? 0 : Number(ticket.totalAzn),
        discountAzn:
          body.method === "IKRAM"
            ? 0
            : Math.max(
                0,
                Math.round(
                  (liveLines.reduce((sum, line) => sum + line.qty * Number(line.unitPriceAzn), 0) -
                    Number(ticket.totalAzn)) *
                    100,
                ) / 100,
              ),
        limitBalanceAfter,
        holderName: limitHolderName,
        lines: liveLines.map((line) => ({
          name: line.description,
          qty: line.qty,
          amount: Math.round(line.qty * Number(line.unitPriceAzn) * 100) / 100,
        })),
      },
    },
    201,
  );
  } catch (err) {
    return handleRouteError(err);
  }
}
