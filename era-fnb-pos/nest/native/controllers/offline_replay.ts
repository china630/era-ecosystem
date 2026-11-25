/** Lifted from nest/generated/offline_replay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const itemSchema = z.object({
  id: z.string(),
  kind: z.enum(["pay", "fire"]),
  ticketId: z.string(),
  payload: z.record(z.unknown()),
});

const bodySchema = z.object({
  actions: z.array(itemSchema).min(1).max(50),
});

/** Replay queued pay/fire from offline client. */


@Controller()
export class OfflineReplayController {
  @Post("api/offline/replay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OFFLINE_REPLAY);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { actions } = bodySchema.parse(httpReq.body);
    const origin = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).origin;
    const results: { id: string; ok: boolean; status: number }[] = [];

    for (const action of actions) {
      const path =
        action.kind === "pay"
          ? `/api/tickets/${action.ticketId}/pay`
          : `/api/tickets/${action.ticketId}/fire`;
      const res = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: nestHeader(httpReq, "cookie") ?? "",
        },
        body: JSON.stringify(action.payload),
      });
      results.push({ id: action.id, ok: res.ok, status: res.status });
    }

    return sendJson(httpRes, { replayed: results.length, results });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
