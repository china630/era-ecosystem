import { NextResponse } from "next/server";
import { IndustryModuleInactiveError } from "@era/satellite-kit";
import { requireRetailSatellite } from "@/lib/retail-module-gate";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
  }
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

/** Call at the start of operational retail API handlers. Fail-closed. */
export async function assertRetailEntitled(): Promise<void> {
  await requireRetailSatellite();
}
