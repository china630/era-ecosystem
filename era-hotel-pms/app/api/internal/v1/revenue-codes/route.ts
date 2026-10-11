import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";
import { assertEnvServiceToken } from "@era/satellite-kit";

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Active hotel revenue codes for department satellites.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN. organizationId selects the tenant.
 */
export async function GET(request: Request) {
  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) {
      return Response.json({ error: "organizationId required" }, { status: 400 });
    }
    enterRequestTenant(organizationId);
    const codes = await prisma.revenueCode.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });
    return Response.json({ codes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revenue codes failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
