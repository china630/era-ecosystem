import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPaymentLink, createBookingSlot, createShipment, createPortalLink, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { isRetailPreset } from "@/lib/retail-preset";
import { postHotelSettlementPending, postRoomCharge } from "@/lib/pms-bridge-client";
import { revenueCodeForSaleLine } from "@/lib/revenue-code";
import { requestOrganizationId } from "@/lib/request-organization";
import { getReceiptForPay, markReceiptPaid, markReceiptPendingHub } from "@/lib/receipt.service";
import { outletToPrintOverlay, resolveRetailPrintContacts } from "@/lib/org-print-contacts";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  paymentMethod: z.string().default("cash"),
  customerPhone: z.string().max(32).optional(),
  loyaltyRef: z.string().max(64).optional(),
  delivery: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
  reservationId: z.string().uuid().optional(),
  roomNumber: z.string().max(16).optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts/:id/pay", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);

    const receipt = await getReceiptForPay(id);
    if (!receipt) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    if (receipt.status === "PAID" || receipt.status === "PENDING_HUB") {
      const printChrome = resolveRetailPrintContacts(
        outletToPrintOverlay(receipt.outlet),
      );
      return sendJson(httpRes, { ...receipt, printChrome });
    }

    const {
      isFiscalPaymentMethod,
      isFiscalSkipped,
      resolveOperatingMode,
      resolveSettlementPolicy,
      shouldDeferWalkInToHub,
      shouldFiscalizeOnParent,
      shouldRouteRevenueToParent,
    } = await import("@era/satellite-kit");

    const orgId = requestOrganizationId();
    const mode = await resolveOperatingMode(orgId);
    const amountNet = Number(receipt.amountNet);
    const method = body.paymentMethod.trim().toUpperCase();
    const isRoomCharge =
      method === "ROOM_CHARGE" ||
      (shouldRouteRevenueToParent(mode) &&
        Boolean(body.reservationId || body.roomNumber));
    const policy = await resolveSettlementPolicy(orgId);
    const walkInHub =
      !isRoomCharge &&
      (shouldRouteRevenueToParent(mode) || shouldDeferWalkInToHub(policy));

    const activeLines = receipt.lines.filter((line) => line.lineStatus === "ACTIVE");

    let fiscalNumber: string | null = null;
    let settlementChannel: string | null = null;

    if (isRoomCharge) {
      if (!body.reservationId && !body.roomNumber) {
        return sendJson(httpRes, { error: "reservationId or roomNumber required for room charge" }, 400);
      }
      if (activeLines.length === 0) return sendJson(httpRes, { error: "Finance SKU is required" }, 400);
      for (const line of activeLines) {
        const sku = line.plu?.trim();
        if (!sku) return sendJson(httpRes, { error: `Finance SKU is required for ${line.description}` }, 400);
        const { retailReceiptLineRef } = await import(
          "@era/satellite-kit/integration/folio-charge-ref"
        );
        const lineKey = retailReceiptLineRef(receipt.id, line.id);
        const revenueCode = await revenueCodeForSaleLine({
          plu: sku,
          outletRevenueCode: receipt.outlet.revenueCode,
        });
        const charge = await postRoomCharge(
          {
            reservationId: body.reservationId,
            roomNumber: body.roomNumber,
            revenueCode,
            amount: Number(line.lineTotal),
            qty: line.qty,
            productSku: sku,
            description: `${line.qty}x ${line.description}`,
            outletCode: receipt.outlet.code,
            externalTicketId: lineKey,
          },
          lineKey,
        );
        if (!charge.ok) {
          return sendJson(httpRes, { error: `Hotel folio charge failed: ${charge.status}` }, 502);
        }
      }
      settlementChannel = "HOTEL_FOLIO";
    } else if (walkInHub) {
      if (activeLines.length === 0) return sendJson(httpRes, { error: "Finance SKU is required" }, 400);
      const pendingIds: string[] = [];
      for (const line of activeLines) {
        const sku = line.plu?.trim();
        if (!sku) return sendJson(httpRes, { error: `Finance SKU is required for ${line.description}` }, 400);
        const revenueCode = await revenueCodeForSaleLine({
          plu: sku,
          outletRevenueCode: receipt.outlet.revenueCode,
        });
        const pending = await postHotelSettlementPending({
          sourceRef: receipt.id,
          amount: Number(line.lineTotal),
          description: `${line.qty}x ${line.description}`,
          payerLabel: body.customerPhone?.trim() || receipt.outlet.code,
          idempotencyKey: (
            await import("@era/satellite-kit/integration/folio-charge-ref")
          ).retailPendingLineRef(receipt.id, line.id),
          sku,
          qty: line.qty,
          revenueCode,
        });
        pendingIds.push(pending.id);
      }
      const deferred = await markReceiptPendingHub(id, {
        paymentMethod: body.paymentMethod,
        customerPhone: body.customerPhone?.trim() || null,
        loyaltyRef: body.loyaltyRef?.trim() || null,
        hubPendingIds: JSON.stringify(pendingIds),
      });
      const printChrome = resolveRetailPrintContacts(
        outletToPrintOverlay(receipt.outlet),
      );
      return sendJson(httpRes, { ...deferred, printChrome });
    } else if (isFiscalPaymentMethod(body.paymentMethod) && !shouldFiscalizeOnParent(mode)) {
      const { saleForSatelliteRouted } = await import("@era/satellite-kit");
      const outcome = await saleForSatelliteRouted({
        documentRef: id,
        organizationId: orgId,
        outletCode: receipt.outlet.code,
        registerRef: receipt.register.code,
        fiscalDeviceId: body.fiscalDeviceId,
        bankTerminalId: body.bankTerminalId,
        shiftFiscalDeviceId: receipt.shift.fiscalDeviceId ?? undefined,
        shiftBankTerminalId: receipt.shift.bankTerminalId ?? undefined,
        lines: receipt.lines.map((l) => ({
          sku: l.plu ?? l.barcode ?? undefined,
          name: l.description || "Item",
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
        })),
        tenders: [{ method: body.paymentMethod, amount: amountNet }],
      });
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
      settlementChannel = isFiscalSkipped(outcome)
        ? "RECORDED_NO_DEVICE"
        : "OWN_FISCAL";
    }

    // Local / fiscal sale → Finance. Room charge is FOLIO only (no REVENUE_EVENT).
    if (!isRoomCharge) {
      await assertRevenueEventForPublish({
        organizationId: orgId,
        fromSatelliteKey: "industry_retail",
        eventType: SATELLITE_RETAIL_SALE_COMPLETED,
      });
    }

    const paid = await markReceiptPaid(id, {
      paymentMethod: body.paymentMethod,
      customerPhone: body.customerPhone?.trim() || null,
      loyaltyRef: body.loyaltyRef?.trim() || null,
      fiscalNumber,
      reservationId: body.reservationId ?? null,
      roomNumber: body.roomNumber ?? null,
      settlementChannel,
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
    if (!isRoomCharge) {
      await dispatchSatelliteEvent({
        type: SATELLITE_RETAIL_SALE_COMPLETED,
        payload: {
          outletId: receipt.outletId,
          registerId: receipt.registerId,
          shiftId: receipt.shiftId,
          receiptId: receipt.id,
          preset,
          amountNet,
          currency: "AZN",
          paymentMethod: body.paymentMethod,
          lineCount: receipt.lines.length,
          customerPhone: body.customerPhone?.trim(),
          loyaltyRef: body.loyaltyRef?.trim(),
          promoCode: receipt.promoCode ?? undefined,
        },
      });
    }

    const organizationId = requestOrganizationId();
    const recipient =
      process.env.RETAIL_NOTIFY_RECIPIENT?.trim() || `receipt-${receipt.id}@local`;
    let payUrl: string | undefined;
    try {
      const link = (await createPaymentLink(
        {
          amountAzn: amountNet,
          sourceEntityType: "retail_receipt",
          sourceEntityId: receipt.id,
          description: `Receipt ${receipt.id}`,
        },
        { organizationId },
      )) as { paymentUrl?: string; portalPayUrl?: string };
      payUrl = link.paymentUrl ?? link.portalPayUrl;
    } catch {
      payUrl = undefined;
    }
    try {
      await createPortalLink(
        {
          entityType: "retail_receipt",
          entityId: receipt.id,
        },
        { organizationId },
      );
    } catch {
      // optional portal link
    }
    try {
      await createBookingSlot(
        {
          resourceKey: "pickup",
          resourceName: "Click and collect",
          startsAt: new Date(Date.now() + 3600_000).toISOString(),
          endsAt: new Date(Date.now() + 7200_000).toISOString(),
          capacity: 8,
        },
        { organizationId },
      );
    } catch {
      // optional pickup slot
    }
    const wantsDelivery =
      body.delivery === true || presetRaw === "ecommerce";
    if (wantsDelivery) {
      try {
        await createShipment(
          {
            sourceEntityType: "retail_receipt",
            sourceEntityId: receipt.id,
            externalRef: receipt.id,
            recipientPhone: process.env.RETAIL_NOTIFY_PHONE?.trim(),
          },
          { organizationId },
        );
      } catch {
        // optional platform delivery
      }
    }
    try {
      await createPromotion(
        {
          code: `RETAIL-SALE-${receipt.id.slice(0, 8)}`,
          name: "Retail sale promotion",
          discountType: "PERCENT",
          discountValue: 5,
          metadata: { receiptId: receipt.id },
        },
        { organizationId },
      );
    } catch {
      // optional loyalty
    }
    if (body.customHostname?.trim()) {
      try {
        await createCustomDomain(
          {
            hostname: body.customHostname.trim(),
            metadata: { receiptId: receipt.id },
          },
          { organizationId },
        );
      } catch {
        // optional domain
      }
    }
    await trySendPlatformNotification({
      templateKey: "retail.sale.completed",
      channel: "EMAIL",
      messageClass: "TRANSACTIONAL",
      recipient,
      sourceEntityType: "retail_receipt",
      sourceEntityId: receipt.id,
      body: `Sale ${amountNet.toFixed(2)} AZN${payUrl ? ` — pay: ${payUrl}` : ""}`,
      payload: { amountNet, preset, payUrl },
    });

    const printChrome = resolveRetailPrintContacts(
      outletToPrintOverlay(receipt.outlet),
    );
    return sendJson(httpRes, { ...paid, printChrome });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
