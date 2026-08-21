import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IndustryModuleInactiveError } from "@era/satellite-kit";
import { requireFnbSatellite } from "@/lib/fnb-module-gate";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(err.errors.map((e) => e.message).join("; "), 400);
  }
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof Error) {
    return jsonError(err.message, 500);
  }
  return jsonError("Internal error", 500);
}

/** Call at the start of operational F&B API handlers. */
export async function assertFnbEntitled(): Promise<void> {
  await requireFnbSatellite();
}
