import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPaymentLink,
  createBookingSlot,
  createShipment,
  createPortalLink,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { isRetailPreset } from "@/lib/retail-preset";
import { postRoomCharge } from "@/lib/pms-bridge-client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  paymentMethod: z.string().default("cash"),
  customerPhone: z.string().max(32).optional(),
  loyaltyRef: z.string().max(64).optional(),
  delivery: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
  reservationId: z.string().uuid().optional(),
  roomNumber: z.string().max(16).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertRetailEntitled();
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: true,
        outlet: true,
        register: true,
        shift: true,
      },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "PAID") return jsonOk(receipt);

    const {
      fiscalizeForSatellite,
      isFiscalPaymentMethod,
      isFiscalSkipped,
      resolveOperatingMode,
      satelliteOrganizationId,
      shouldFiscalizeOnParent,
      shouldRouteRevenueToParent,
    } = await import("@era/satellite-kit");

    const orgId = satelliteOrganizationId();
    const mode = await resolveOperatingMode(orgId);
    const amountNet = Number(receipt.amountNet);
    const method = body.paymentMethod.trim().toUpperCase();
    const isRoomCharge =
      method === "ROOM_CHARGE" ||
      (shouldRouteRevenueToParent(mode) &&
        Boolean(body.reservationId || body.roomNumber));

    let fiscalNumber: string | null = null;
    let settlementChannel: string | null = null;

    if (isRoomCharge) {
      if (!body.reservationId && !body.roomNumber) {
        return jsonError("reservationId or roomNumber required for room charge", 400);
      }
      const charge = await postRoomCharge(
        {
          reservationId: body.reservationId,
          roomNumber: body.roomNumber,
          revenueCode: "RETAIL",
          amount: amountNet,
          description: `Retail ${receipt.outlet.code} — ${receipt.id.slice(0, 8)}`,
          outletCode: receipt.outlet.code,
          externalTicketId: receipt.id,
        },
        receipt.id,
      );
      if (!charge.ok) {
        return jsonError(`Hotel folio charge failed: ${charge.status}`, 502);
      }
      settlementChannel = "HOTEL_FOLIO";
    } else if (isFiscalPaymentMethod(body.paymentMethod) && !shouldFiscalizeOnParent(mode)) {
      const outcome = await fiscalizeForSatellite(
        {
          documentRef: id,
          amount: amountNet,
          paymentMethod: body.paymentMethod,
          outletCode: receipt.outlet.code,
        },
        orgId,
      );
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
      settlementChannel = "OWN_FISCAL";
    }

    const paid = await prisma.receipt.update({
      where: { id },
      data: {
        status: "PAID",
        paymentMethod: body.paymentMethod,
        customerPhone: body.customerPhone?.trim() || null,
        loyaltyRef: body.loyaltyRef?.trim() || null,
        fiscalNumber,
        paidAt: new Date(),
        reservationId: body.reservationId ?? null,
        roomNumber: body.roomNumber ?? null,
        settlementChannel,
      },
      include: { lines: true },
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
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

    const organizationId = satelliteOrganizationId();
    const recipient =
      process.env.RETAIL_NOTIFY_RECIPIENT?.trim() || `receipt-${receipt.id}@local`;
    let payUrl: string | undefined;
    if (organizationId) {
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

    return jsonOk(paid);
  } catch (err) {
    return handleRouteError(err);
  }
}
