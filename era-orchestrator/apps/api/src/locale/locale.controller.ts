import { BadRequestException, Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { IsIn, IsString } from "class-validator";
import { Public } from "../auth/decorators/public.decorator";

const LOCALES = ["az", "ru", "en"] as const;
const COOKIE = "era_i18n_lang";

class SetLocaleDto {
  @IsString()
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];
}

/** Same-origin cookie for the website. Next rewrites `/api/locale` here. */
@Controller("v1/locale")
export class LocaleController {
  @Public()
  @Post()
  set(
    @Body() body: SetLocaleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!LOCALES.includes(body.locale)) {
      throw new BadRequestException("Unsupported locale");
    }
    const forwarded = req.headers["x-forwarded-proto"];
    const secure =
      forwarded === "https" || process.env.ERA_I18N_COOKIE_SECURE === "true";
    res.cookie(COOKIE, body.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 1000,
      sameSite: "lax",
      secure,
      httpOnly: false,
    });
    return { ok: true, locale: body.locale };
  }
}
