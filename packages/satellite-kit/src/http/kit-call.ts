import type { CookieReader, HeaderReader } from "../auth/middleware-helpers";

/** Header bag shared by Nest handlers and the old Web `Request` wrappers. */
export type KitHeaderSource = {
  get(name: string): string | null;
};

export type KitCall = {
  headers: KitHeaderSource;
  body?: unknown;
};

export function kitHeadersOf(source: Request | KitHeaderSource): KitHeaderSource {
  if (typeof (source as KitHeaderSource).get === "function" && !("headers" in source)) {
    return source as KitHeaderSource;
  }
  return { get: (name) => (source as Request).headers.get(name) };
}

type ExpressLike = {
  get?: (name: string) => string | undefined;
  headers?: Record<string, unknown>;
  method?: string;
  originalUrl?: string;
  url?: string;
};

function headerValue(bag: Record<string, unknown>, name: string): string | null {
  const value = bag[name.toLowerCase()] ?? bag[name];
  if (Array.isArray(value)) return value[0] == null ? null : String(value[0]);
  return value == null ? null : String(value);
}

export function expressKitHeaders(req: ExpressLike): KitHeaderSource {
  return {
    get(name: string) {
      const direct = req.get?.(name);
      if (direct) return direct;
      return headerValue(req.headers ?? {}, name);
    },
  };
}

export function expressCookieReader(req: ExpressLike): CookieReader {
  const raw = String(req.headers?.cookie ?? req.get?.("cookie") ?? "");
  const jar = new Map<string, string>();
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    jar.set(part.slice(0, eq).trim(), decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return {
    get(name: string) {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
  };
}

export function expressHeaderReader(req: ExpressLike): HeaderReader {
  const headers = expressKitHeaders(req);
  const url = req.originalUrl ?? req.url ?? "";
  const query = url.indexOf("?");
  const path = query === -1 ? url : url.slice(0, query);
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return {
    get(name: string) {
      const key = name.toLowerCase();
      if (key === "x-era-pathname") return pathname;
      if (key === "x-era-method") return req.method ?? null;
      if (key === "cookie") return String(req.headers?.cookie ?? req.get?.("cookie") ?? "") || null;
      return headers.get(name);
    },
  };
}
