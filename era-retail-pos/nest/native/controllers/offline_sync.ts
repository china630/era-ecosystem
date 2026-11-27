/** Lifted from nest/generated/offline_sync.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enqueueOfflineReceipts, listPendingOfflineReceipts } from "@/lib/offline-sync.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  clientId: z.string(),
  receipts: z.array(z.record(z.unknown())),
});


@Controller()
export class OfflineSyncController {
  @Post("api/offline/sync")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const rows = await enqueueOfflineReceipts(body.clientId, body.receipts);
    return sendJson(httpRes, { queued: rows.length, ids: rows.map((r) => r.id) }, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Get("api/offline/sync")
  @HttpCode(200)
  async get_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const clientId = requestUrl.searchParams.get("clientId");
    const pending = await listPendingOfflineReceipts(clientId);
    return sendJson(httpRes, { pending });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
