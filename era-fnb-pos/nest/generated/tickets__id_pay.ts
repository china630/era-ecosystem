import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { closeTicketOnPay, findOpenPosShiftDevices, findTicketForPay, takeLimitHolderCredit } from "@/lib/ticket-pay.service";
import { findActiveFnbLimitHolder } from "@/lib/limit-holder.service";
import { daySeqMap, releaseTableForTicket } from "@/lib/ticket-helpers";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { assertFbRevenueChannel, dispatchFbSaleCompleted } from "@/lib/fb-finance-events";
import { SATELLITE_FB_SALE_COMPLETED } from "@era/contracts";
import { dispatchStockConsumptionIfEnabled } from "@/lib/stock-consumption";
import { payBlockedReason, resolveTicketSettlement, shouldFiscalizeAtPos } from "@/lib/billing-router";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireOpenShift } from "@/lib/open-shift";
import { outletToPrintOverlay, resolveFnbPrintContacts } from "@/lib/org-print-contacts";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type PayTicket = NonNullable<Awaited<ReturnType<typeof findTicketForPay>>>;
type PayTicketLine = PayTicket["lines"][number];

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/pay", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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

  const { id } = httpReq.params;
  const body = paySchema.parse(httpReq.body);
  const { assertFnbPaymentMethodAllowed } = await import('@/lib/org-payment-methods');
  const hallTender = body.method === "LIMIT" || body.method === "IKRAM";
  if (!hallTender) assertFnbPaymentMethodAllowed(body.method);

  const ticket = await findTicketForPay(id);
  if (!ticket) {
    return sendJson(httpRes, { error: "Ticket not found" }, 404);
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return sendJson(httpRes, 
      { error: "Ticket is not open for payment" }, 400);
  }

  const organizationId = requestOrganizationId();
  if (body.method === "LIMIT" && (!session || !sessionHasFnbPermission(session, PERMISSIONS.TICKETS_LIMIT))) {
    return sendJson(httpRes, { error: "Limit tender is not granted", code: "FNB_NO_LIMIT" }, 403);
  }
  if (body.method === "IKRAM" && (!session || !sessionHasFnbPermission(session, PERMISSIONS.TICKETS_IKRAM))) {
    return sendJson(httpRes, { error: "Compliment tender is not granted", code: "FNB_NO_IKRAM" }, 403);
  }
  if (hallTender && !ticket.outlet.hallMode) {
    return sendJson(httpRes, { error: "Hall tenders require hall mode on the outlet" }, 409);
  }
  const liveLines = ticket.lines.filter((l: PayTicketLine) => l.kitchenStatus !== "VOID");
  const due = Number(ticket.totalAzn);
  const amount = body.method === "IKRAM" ? 0 : (body.amount ?? due);
  let cashTendered: number | null = null;
  let changeAzn: number | null = null;
  if (body.method === "CASH") {
    cashTendered = body.cashTendered ?? due;
    if (cashTendered + 0.001 < due) {
      return sendJson(httpRes, { error: "Cash tendered is less than the check" }, 400);
    }
    changeAzn = Math.round((cashTendered - due) * 100) / 100;
  }
  if (liveLines.length === 0 || (body.method !== "IKRAM" && amount <= 0)) {
    return sendJson(httpRes, { error: "Nothing to pay" }, 400);
  }
  let limitBalanceAfter: number | null = null;
  let limitHolderName: string | null = null;
  if (body.method === "LIMIT") {
    if (!body.limitHolderId) {
      return sendJson(httpRes, { error: "Limit holder is required" }, 400);
    }
    const holder = await findActiveFnbLimitHolder(organizationId, body.limitHolderId);
    if (!holder) return sendJson(httpRes, { error: "Limit holder not found" }, 404);
    limitHolderName = holder.displayName;
    const ceiling = Number(holder.ceilingAzn);
    const used = Number(holder.usedAzn);
    if (used + due > ceiling + 0.001) {
      return sendJson(httpRes, 
        { error: "Limit ceiling exceeded", availableAzn: Math.round((ceiling - used) * 100) / 100 }, 409);
    }
    limitBalanceAfter = Math.round((ceiling - used - due) * 100) / 100;
  }
  const openShift = await requireOpenShift(ticket.outletId);

  const settlement = await resolveTicketSettlement(ticket);
  const payBlock = payBlockedReason(settlement);
  if (payBlock) {
    return sendJson(httpRes, { error: payBlock }, 400);
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
      (l: PayTicketLine) => l.kitchenStatus !== "VOID",
    );
    const openShift = await findOpenPosShiftDevices(ticket.outletId);
    const outcome = await saleForSatelliteRouted({
      documentRef: ticket.id,
      organizationId: organizationId || undefined,
      outletCode: ticket.outlet.code,
      fiscalDeviceId: body.fiscalDeviceId ?? openShift?.fiscalDeviceId ?? undefined,
      bankTerminalId: body.bankTerminalId ?? openShift?.bankTerminalId ?? undefined,
      shiftFiscalDeviceId: openShift?.fiscalDeviceId ?? undefined,
      shiftBankTerminalId: openShift?.bankTerminalId ?? undefined,
      lines: activeLines.map((l: PayTicketLine) => ({
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
    const taken = await takeLimitHolderCredit({
      limitHolderId: body.limitHolderId,
      organizationId,
      due,
    });
    if (taken.count !== 1) {
      return sendJson(httpRes, { error: "Limit ceiling exceeded" }, 409);
    }
  }
  await closeTicketOnPay(id, {
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
    const lineCount = ticket.lines.filter((l: PayTicketLine) => l.kitchenStatus !== "VOID").length;
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

  return sendJson(httpRes, 
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
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
