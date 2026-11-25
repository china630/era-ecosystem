import type { CookieOptions } from "express";

/**
 * Map kit/Next-style cookie options (maxAge in seconds) onto Express (maxAge in ms).
 */
export function expressCookieFromSeconds(opts: {
  path?: string;
  maxAge?: number;
  sameSite?: CookieOptions["sameSite"];
  secure?: boolean;
  httpOnly?: boolean;
}): CookieOptions {
  return {
    path: opts.path,
    sameSite: opts.sameSite,
    secure: opts.secure,
    httpOnly: opts.httpOnly,
    maxAge: opts.maxAge == null ? undefined : opts.maxAge * 1000,
  };
}
