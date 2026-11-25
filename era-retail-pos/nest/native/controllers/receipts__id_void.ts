/** Lifted from nest/generated/receipts__id_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { receiptVoidDenied } from "@/lib/receipt-status-gates";
import { getReceiptById, voidReceiptById } from "@/lib/receipt.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReceiptsIdVoidController {
  @Post("api/receipts/:id/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.RECEIPTS_VOID_LINE);
    const { id } = httpReq.params;
    const receipt = await getReceiptById(id);
    if (!receipt) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    if (receipt.status === "VOID") return sendJson(httpRes, receipt);
    const voidDenied = receiptVoidDenied(receipt.status);
    if (voidDenied) return sendJson(httpRes, { error: voidDenied }, 400);

    const voided = await voidReceiptById(id);
    return sendJson(httpRes, voided);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
