import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  IndustryModuleInactiveError,
  SatelliteChannelDisabledError,
} from "@era/satellite-kit";
import { isSatelliteBillingBlockedError } from "@era/satellite-kit/billing/gate";
import {
  FnbHotelModeError,
  FnbQuotaError,
  FnbSubmoduleInactiveError,
} from "@/lib/fnb-module-gate";
import { FnbSoldOutError } from "@/lib/fnb-sold-out";
import { FnbWaiterNoPayError } from "@/lib/fnb-roles";
import { ShiftRequiredError, ShiftStaleError } from "@/lib/open-shift";
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export type RouteErrorResult = { status: number; body: Record<string, unknown> };

export function describeRouteError(err: unknown): RouteErrorResult {
  if (isSatelliteBillingBlockedError(err)) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, billingStatus: err.billingStatus },
    };
  }
  if (err instanceof ZodError) {
    return { status: 400, body: { error: err.errors.map((e) => e.message).join("; ") } };
  }
  if (err instanceof IndustryModuleInactiveError) {
    return { status: 403, body: { error: err.message } };
  }
  if (err instanceof SatelliteChannelDisabledError) {
    return { status: 403, body: { error: err.message, code: err.code } };
  }
  if (err instanceof FnbHotelModeError) {
    return { status: 403, body: { error: err.message, code: err.code } };
  }
  if (err instanceof FnbSubmoduleInactiveError) {
    return { status: 403, body: { error: err.message, code: err.code, moduleKey: err.moduleKey } };
  }
  if (err instanceof FnbQuotaError) {
    return { status: 429, body: { error: err.message, code: err.code } };
  }
  if (err instanceof FnbSoldOutError) {
    return { status: 409, body: { error: err.message, code: err.code, plu: err.plu } };
  }
  if (err instanceof FnbWaiterNoPayError) {
    return { status: 403, body: { error: err.message, code: err.code } };
  }
  if (err instanceof ShiftRequiredError || err instanceof ShiftStaleError) {
    return { status: 409, body: { error: err.message, code: err.code } };
  }
  if (err instanceof Error && err.name === "FiscalError") {
    return { status: 400, body: { error: err.message } };
  }
  if (err instanceof Error) {
    if (err.message === "Unauthorized") {
      return { status: 401, body: { error: err.message } };
    }
    if (err.message.startsWith("Forbidden")) {
      return { status: 403, body: { error: err.message } };
    }
    const codeRaw = (err as unknown as { code?: unknown }).code;
    const code = typeof codeRaw === "string" ? codeRaw : "";
    if (code === "OUTLET_RETIRED" || code === "OUTLET_REQUIRED" || code === "OUTLET_NO_TILL") {
      return { status: 400, body: { error: err.message, code } };
    }
    return { status: 500, body: { error: err.message } };
  }
  return { status: 500, body: { error: "Internal error" } };
}

export function handleRouteError(err: unknown) {
  const described = describeRouteError(err);
  return NextResponse.json(described.body, { status: described.status });
}
