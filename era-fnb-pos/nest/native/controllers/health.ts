/** Lifted from nest/generated/health.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { isPmsStubMode } from "@/lib/pms-bridge-client";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HealthController {
  @Get("api/health")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  return sendJson(httpRes, {
    ok: true,
    service: "era-fnb-pos",
    pmsStub: isPmsStubMode(),
  });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
