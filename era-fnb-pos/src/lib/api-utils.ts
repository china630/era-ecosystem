import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IndustryModuleInactiveError } from "@era/satellite-kit";
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

export function handleRouteError(err: unknown) {
  if (isSatelliteBillingBlockedError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, billingStatus: err.billingStatus },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return jsonError(err.errors.map((e) => e.message).join("; "), 400);
  }
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof FnbHotelModeError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 },
    );
  }
  if (err instanceof FnbSubmoduleInactiveError) {
    return NextResponse.json(
      { error: err.message, code: err.code, moduleKey: err.moduleKey },
      { status: 403 },
    );
  }
  if (err instanceof FnbQuotaError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 429 },
    );
  }
  if (err instanceof FnbSoldOutError) {
    return NextResponse.json(
      { error: err.message, code: err.code, plu: err.plu },
      { status: 409 },
    );
  }
  if (err instanceof FnbWaiterNoPayError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 },
    );
  }
  if (err instanceof ShiftRequiredError || err instanceof ShiftStaleError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 409 },
    );
  }
  if (err instanceof Error && err.name === "FiscalError") {
    return jsonError(err.message, 400);
  }
  if (err instanceof Error) {
    if (err.message === "Unauthorized") {
      return jsonError(err.message, 401);
    }
    if (err.message.startsWith("Forbidden")) {
      return jsonError(err.message, 403);
    }
    return jsonError(err.message, 500);
  }
  return jsonError("Internal error", 500);
}
