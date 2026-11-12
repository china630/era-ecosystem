import type { Request as ExpressRequest } from "express";

/** Shared S2S gate for hotel → clinic guest-care routes. */
export function assertGuestCareServiceToken(req: ExpressRequest): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const h = req.headers.authorization;
  if (typeof h !== "string" || !h.toLowerCase().startsWith("bearer ")) return false;
  return h.slice(7).trim() === expected;
}

export function parseGuestCarePersonParams(query: {
  globalPersonId?: unknown;
  organizationId?: unknown;
}): { globalPersonId: string; organizationId: string } | { error: "missing_params" } {
  const globalPersonId = String(query.globalPersonId ?? "").trim();
  const organizationId = String(query.organizationId ?? "").trim();
  if (!globalPersonId || !organizationId) return { error: "missing_params" };
  return { globalPersonId, organizationId };
}
