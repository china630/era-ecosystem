import { Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";
import { ERA_I18N_COOKIE, eraLocaleCookieOptions, isLocale } from "@era/i18n-common";


const schema = z.object({ locale: z.string() });

@Controller()
export class LocaleController {

  @Post("api/locale")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    await withClinicHttp(httpReq, async () => {


  // audit-exempt: cookie locale preference (kit DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES /api/locale)
  const body = schema.parse(httpReq.body);
  if (!isLocale(body.locale)) {
    sendJson(httpRes, { error: "Unsupported locale" }, 400); return;
  }
  const opts = eraLocaleCookieOptions();
  const maxAge = typeof opts.maxAge === "number" ? opts.maxAge * 1000 : undefined;
  httpRes.cookie(ERA_I18N_COOKIE, body.locale, { ...opts, maxAge });
  httpRes.cookie("NEXT_LOCALE", body.locale, { ...opts, maxAge });
  sendJson(httpRes, { ok: true, locale: body.locale }, 200); return;

        });
  }
}
