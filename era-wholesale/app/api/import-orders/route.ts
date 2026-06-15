import { z } from "zod";
import { financeExternalPurchase } from "@era/satellite-kit";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { wholesaleTermDueDate } from "@/lib/production-calendar";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  sku: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPriceForeign: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  externalRef: z.string().min(1),
  supplierCounterpartyId: z.string().optional(),
  supplierVoen: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  amountForeign: z.coerce.number().min(0),
  paymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  try {
    const rows = await prisma.importPurchaseOrder.findMany({
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const orderDate = new Date().toISOString().slice(0, 10);
    const dueDate = await wholesaleTermDueDate(orderDate, body.paymentTermDays);
    const created = await prisma.importPurchaseOrder.create({
      data: {
        externalRef: body.externalRef,
        supplierCounterpartyId: body.supplierCounterpartyId,
        supplierVoen: body.supplierVoen?.replace(/\D/g, ""),
        currencyCode: body.currencyCode.toUpperCase(),
        amountForeign: body.amountForeign,
        paymentTermDays: body.paymentTermDays,
        dueDate: new Date(dueDate),
        lines: {
          create: body.lines.map((l) => ({
            sku: l.sku,
            quantity: l.quantity,
            unitPriceForeign: l.unitPriceForeign,
          })),
        },
      },
      include: { lines: true },
    });
    return jsonOk(created, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = z
      .object({
        id: z.string(),
        confirm: z.literal(true),
      })
      .parse(await req.json());
    const order = await prisma.importPurchaseOrder.findUnique({
      where: { id: body.id },
      include: { lines: true },
    });
    if (!order) return jsonError("Import order not found", 404);
    if (order.status === "CONFIRMED") return jsonOk(order);

    const handoff = await financeExternalPurchase(
      {
        externalRef: order.externalRef,
        counterpartyId: order.supplierCounterpartyId ?? undefined,
        lines: order.lines.map((l) => ({
          sku: l.sku,
          quantity: Number(l.quantity),
          unitPrice: l.unitPriceForeign ? Number(l.unitPriceForeign) : undefined,
        })),
      },
      { authHeader: req.headers.get("authorization") },
    );

    const confirmed = await prisma.importPurchaseOrder.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        financePurchaseRef: String(handoff.externalRef ?? order.externalRef),
      },
      include: { lines: true },
    });
    return jsonOk({ order: confirmed, finance: handoff });
  } catch (err) {
    return handleRouteError(err);
  }
}
