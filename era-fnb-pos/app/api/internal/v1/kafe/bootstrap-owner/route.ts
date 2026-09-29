import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { bootstrapKafeOwner } from "@/lib/kafe-org-bootstrap";

export async function POST(request: Request) {
  const authz = assertEnvServiceToken({
    expectedEnvKeys: [
      "SATELLITE_EVENT_SERVICE_TOKEN",
      "CONTROL_PLANE_SERVICE_TOKEN",
    ],
    authorization: request.headers.get("authorization"),
    xServiceToken: request.headers.get("x-service-token"),
    allowOpenInNonProduction: false,
  });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  let body: {
    organizationId?: unknown;
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    cafeName?: unknown;
    activeModules?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName : "";
  const cafeName = typeof body.cafeName === "string" ? body.cafeName : "";
  const activeModules = Array.isArray(body.activeModules)
    ? body.activeModules.filter((k): k is string => typeof k === "string")
    : [];

  try {
    const result = await bootstrapKafeOwner({
      organizationId,
      email,
      password,
      fullName,
      cafeName,
      activeModules,
    });
    return NextResponse.json({ ok: true, login: result.login });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
