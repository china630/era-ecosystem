import { NextResponse } from "next/server";

/** Redirect that must not be cached (avoids stale login shell after deploy). */
export function redirectNoStore(url: URL | string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  return res;
}
