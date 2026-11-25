/** Lifted from nest/generated/locale.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { ERA_I18N_COOKIE, eraLocaleCookieOptions, isLocale } from "@era/i18n-common";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const schema = z.object({ locale: z.string() });


@Controller()
export class LocaleController {
  @Post("api/locale")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  // audit-exempt: cookie locale preference (kit DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES /api/locale)
  const body = schema.parse(httpReq.body);
  if (!isLocale(body.locale)) {
    return sendJson(httpRes, { error: "Unsupported locale" }, 400);
  }
  const opts = eraLocaleCookieOptions();
  cookieSeconds(httpRes, ERA_I18N_COOKIE, body.locale, opts.maxAge, { secure: opts.secure });
  cookieSeconds(httpRes, "NEXT_LOCALE", body.locale, opts.maxAge, { httpOnly: false, secure: opts.secure });
  return sendJson(httpRes, { ok: true, locale: body.locale });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
