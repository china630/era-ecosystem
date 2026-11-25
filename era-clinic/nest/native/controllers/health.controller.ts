import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
} from "../../bridge";


@Controller()
export class HealthController {

  @Get("api/health")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {


  return { ok: true, service: "era-clinic" };

        });
  }
}
