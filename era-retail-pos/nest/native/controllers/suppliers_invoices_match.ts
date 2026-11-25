/** Lifted from nest/generated/suppliers_invoices_match.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { financeSupplierMatch } from "@era/satellite-kit";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  invoiceRef: z.string().min(1),
  purchaseTransactionId: z.string().uuid().optional(),
  counterpartyId: z.string().uuid().optional(),
});


@Controller()
export class SuppliersInvoicesMatchController {
  @Post("api/suppliers/invoices/match")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const result = await financeSupplierMatch(body, {
      authHeader: nestHeader(httpReq, "authorization"),
    });
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
