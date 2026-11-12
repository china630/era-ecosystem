import { Prisma } from "@prisma/client";
import { z } from "zod";
import { financeExternalPurchase } from "@era/satellite-kit";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { wholesaleTermDueDate } from "@/lib/production-calendar";
import { confirmImportPurchaseOrder, createImportPurchaseOrder, findImportPurchaseOrderById, listImportPurchaseOrders } from "@/lib/import-order.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type ImportOrderWithLines = Prisma.ImportPurchaseOrderGetPayload<{ include: { lines: true } }>;

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/import-orders", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const rows = await listImportPurchaseOrders();
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/import-orders", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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
    const body = createSchema.parse(httpReq.body);
    const orderDate = todayBakuYmd();
    const dueDate = await wholesaleTermDueDate(orderDate, body.paymentTermDays);
    const created = await createImportPurchaseOrder({
      externalRef: body.externalRef,
      supplierCounterpartyId: body.supplierCounterpartyId,
      supplierVoen: body.supplierVoen?.replace(/\D/g, ""),
      currencyCode: body.currencyCode.toUpperCase(),
      amountForeign: body.amountForeign,
      paymentTermDays: body.paymentTermDays,
      dueDate: new Date(dueDate),
      lines: body.lines.map((l) => ({
        sku: l.sku,
        quantity: l.quantity,
        unitPriceForeign: l.unitPriceForeign,
      })),
    });
    return sendJson(httpRes, created, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/import-orders", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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
    const body = z
      .object({
        id: z.string(),
        confirm: z.literal(true),
      })
      .parse(httpReq.body);
    const order = (await findImportPurchaseOrderById(
      body.id,
    )) as ImportOrderWithLines | null;
    if (!order) return sendJson(httpRes, { error: "Import order not found" }, 404);
    if (order.status === "CONFIRMED") return sendJson(httpRes, order);

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

    const confirmed = await confirmImportPurchaseOrder(
      order.id,
      String(handoff.externalRef ?? order.externalRef),
    );
    return sendJson(httpRes, { order: confirmed, finance: handoff });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
