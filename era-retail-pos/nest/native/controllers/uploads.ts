/** Lifted from nest/generated/uploads.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { createStorageService } from "@era/storage";
import { randomUUID } from "crypto";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class UploadsController {
  @Post("api/uploads")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
