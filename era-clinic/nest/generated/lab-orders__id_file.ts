import { NextResponse } from "next/server";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { findLabOrderFileMeta } from "@/domain/lab/lab-order-write.service";
import { readStoredLabFile } from "@/lib/import/lab-import-files";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function storedPathFromResultJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { storedPath?: string };
    return parsed.storedPath || null;
  } catch {
    return null;
  }
}

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/lab-orders/:id/file", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_FILE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const order = await findLabOrderFileMeta(id);
    if (!order) return sendJson(httpRes, { error: "Lab order not found" }, 404);
    const storedPath = storedPathFromResultJson(order.resultJson);
    if (!storedPath) return sendJson(httpRes, { error: "Lab file not imported" }, 404);
    const file = readStoredLabFile(storedPath);
    if (!file) return sendJson(httpRes, { error: "Lab file missing on disk" }, 404);
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(file.fileName),
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      },
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
