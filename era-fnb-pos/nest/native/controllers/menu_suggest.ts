/** Lifted from nest/generated/menu_suggest.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { suggestDishes } from "@/lib/dish-lexicon";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const q = z.object({ q: z.string().optional() });


@Controller()
export class MenuSuggestController {
  @Get("api/menu/suggest")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const parsed = q.parse({
      q: new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("q") ?? "",
    });
    return sendJson(httpRes, { suggestions: suggestDishes(parsed.q ?? "") });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
