/** Lifted from nest/generated/receipts__id_lines__lineId_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { receiptLineVoidDenied } from "@/lib/receipt-status-gates";
import { getReceiptWithLines, voidReceiptLineAndRecalcTotals } from "@/lib/receipt.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReceiptsIdLinesLineIdVoidController {
  @Post("api/receipts/:id/lines/:lineId/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.RECEIPTS_VOID_LINE);

    const { id, lineId } = httpReq.params;
    const receipt = await getReceiptWithLines(id);
    if (!receipt) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    const lineVoidDenied = receiptLineVoidDenied(receipt.status);
    if (lineVoidDenied) return sendJson(httpRes, { error: lineVoidDenied }, 400);

    const line = receipt.lines.find((item) => item.id === lineId);
    if (!line) return sendJson(httpRes, { error: "Line not found" }, 404);
    if (line.lineStatus === "VOID") {
      return sendJson(httpRes, { receipt, line });
    }

    const linesAfterVoid = receipt.lines.map((item) =>
      item.id === lineId ? { ...item, lineStatus: "VOID" as const } : item,
    );

    const updated = await voidReceiptLineAndRecalcTotals({
      receiptId: id,
      lineId,
      receipt,
      linesAfterVoid,
    });

    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
