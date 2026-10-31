import { NextResponse } from "next/server";
import { z } from "zod";
import { ERA_I18N_COOKIE, eraLocaleCookieOptions, isLocale } from "@era/i18n-common";

export const dynamic = "force-dynamic";

const schema = z.object({ locale: z.string() });

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, locale: body.locale });
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure = forwarded === "https" || url.protocol === "https:";
  const opts = { ...eraLocaleCookieOptions(), secure };
  res.cookies.set(ERA_I18N_COOKIE, body.locale, opts);
  return res;
}
