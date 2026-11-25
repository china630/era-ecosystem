import { Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicHttp,
} from "../../bridge";
import { authCookieName } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";

@Controller()
export class AuthLogoutController {

  @Post("api/auth/logout")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    await withClinicHttp(httpReq, async () => {


  const res = jsonOk({ ok: true });
  httpRes.cookie(authCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  sendJson(httpRes, res.body, res.status); return;

        });
  }
}
