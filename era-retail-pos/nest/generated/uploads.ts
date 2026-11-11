import { createStorageService } from "@era/storage";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/uploads", async (httpReq, httpRes) => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    if (process.env.PLATFORM_STORAGE_ENABLED !== "true") {
      return sendJson(httpRes, 
        { error: "platform_storage add-on required" }, 403);
    }
    const orgId = requestOrganizationId();
    const form = await readNestForm(httpReq);
    const file = form.get("file");
    if (!(file instanceof File)) {
      return sendJson(httpRes, { error: "file required" }, 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const key = `attachments/${orgId}/${randomUUID()}.${ext}`;
    const storage = createStorageService({
      STORAGE_DRIVER: process.env.STORAGE_DRIVER,
      STORAGE_LOCAL_ROOT: process.env.STORAGE_LOCAL_ROOT,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_REGION: process.env.S3_REGION,
      S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
    });
    await storage.putObject(key, buffer, { contentType: file.type || undefined });
    return sendJson(httpRes, { key, publicUrl: storage.getPublicUrl?.(key) });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
