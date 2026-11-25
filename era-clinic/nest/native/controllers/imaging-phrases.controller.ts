import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { listImagingPhrases } from "@/domain/catalog/imaging-phrase.service";

@Controller()
export class ImagingPhrasesController {

  @Get("api/imaging-phrases")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertOpsApiPermission(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const organKey = url.searchParams.get("organKey") ?? undefined;
    return await listImagingPhrases({ organKey });
  
        });
  }
}
