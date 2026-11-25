import { Body, Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { ERA_I18N_COOKIE, eraLocaleCookieOptions, isLocale } from "@era/i18n-common";
import { expressCookieFromSeconds } from "../cookie-opts";

const schema = z.object({ locale: z.string() });

@Controller("api")
export class LocaleController {
  @Post("locale")
  async setLocale(
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const parsed = schema.parse(body);
    if (!isLocale(parsed.locale)) {
      res.status(400).json({ error: "Unsupported locale" });
      return;
    }
    const opts = expressCookieFromSeconds(eraLocaleCookieOptions());
    res.cookie(ERA_I18N_COOKIE, parsed.locale, opts);
    res.cookie("NEXT_LOCALE", parsed.locale, opts);
    res.status(200).json({ ok: true, locale: parsed.locale });
  }
}
