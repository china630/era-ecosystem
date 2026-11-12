import { AsyncLocalStorage } from "node:async_hooks";

type NestHttpFrame = {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
};

const store = new AsyncLocalStorage<NestHttpFrame>();

type Incoming = {
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
  method?: string;
  originalUrl?: string;
  url?: string;
};

/** Keep the Express request visible to code that calls next/headers. */
export function runWithNestHttp<T>(req: Incoming, fn: () => Promise<T>): Promise<T> {
  const raw = String(req.headers?.cookie ?? "");
  const jar = new Map<string, string>();
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    jar.set(part.slice(0, eq).trim(), decodeURIComponent(part.slice(eq + 1).trim()));
  }
  const requestPath = (() => {
    const url = req.originalUrl ?? req.url ?? "";
    const query = url.indexOf("?");
    const path = query === -1 ? url : url.slice(0, query);
    return path.startsWith("/") ? path : `/${path}`;
  })();
  const headers = {
    get(name: string): string | null {
      const key = name.toLowerCase();
      if (key === "x-era-pathname") return requestPath;
      if (key === "x-era-method") return req.method ?? null;
      if (key === "cookie") return raw || null;
      const direct = req.get?.(name);
      if (direct) return direct;
      const value = req.headers?.[key] ?? req.headers?.[name];
      if (Array.isArray(value)) return value[0] == null ? null : String(value[0]);
      return value == null ? null : String(value);
    },
  };
  const cookies = {
    get(name: string): { value: string } | undefined {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
  };
  return store.run({ cookies, headers }, fn);
}

export function nestHttpFrame(): NestHttpFrame | undefined {
  return store.getStore();
}
