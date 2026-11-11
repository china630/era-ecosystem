import { receiptLineVoidDenied } from "@/lib/receipt-status-gates";
import { getReceiptWithLines, voidReceiptLineAndRecalcTotals } from "@/lib/receipt.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts/:id/lines/:lineId/void", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
