import type { StaffSession } from "@/lib/api-utils";

export const CONSTRUCTION_SESSION_KEY = "__constructionSession" as const;

export type ConstructionRequest = {
  originalUrl?: string;
  url?: string;
  method?: string;
  params?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
  [CONSTRUCTION_SESSION_KEY]?: StaffSession;
};

export function queryParam(req: ConstructionRequest, name: string): string | undefined {
  const fromExpress = req.query?.[name];
  if (typeof fromExpress === "string" && fromExpress) return fromExpress;
  if (Array.isArray(fromExpress) && fromExpress[0]) return String(fromExpress[0]);
  try {
    const raw = req.originalUrl ?? req.url ?? "/";
    return new URL(raw, "http://127.0.0.1").searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}
