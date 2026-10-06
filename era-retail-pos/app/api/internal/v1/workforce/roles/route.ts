import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";

function bridgeSecret(): string {
  return process.env.SATELLITE_BRIDGE_SECRET?.trim() || "";
}

/** Control plane reads role codes. Permissions stay on this satellite. */
export async function GET(request: Request) {
  const secret = bridgeSecret();
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId =
    new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }
  enterRequestTenant(organizationId);
  const roles = await prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({
    roles: roles.map((role) => ({
      code: role.code,
      name: role.name,
      active: true,
    })),
  });
}
