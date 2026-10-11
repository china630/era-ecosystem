import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";

function organizationIdFrom(request: Request): string {
  return (
    request.headers.get("x-era-organization-id")?.trim() ||
    new URL(request.url).searchParams.get("organizationId")?.trim() ||
    ""
  );
}

/** Hotel night audit asks which retail outlets still have an open shift. */
export async function GET(request: Request) {
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  const header = request.headers.get("x-pos-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = organizationIdFrom(request);
  if (!organizationId || organizationId === "demo-org") {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }
  try {
    enterRequestTenant(organizationId);
    const { resolveCatalogOrganizationId } = await import("@era/satellite-kit");
    const shifts = await prisma.shift.findMany({
      where: { status: "OPEN" },
      include: { register: { include: { outlet: true } } },
      orderBy: { openedAt: "asc" },
    });
    const open = [];
    for (const shift of shifts) {
      const hub = await resolveCatalogOrganizationId(shift.organizationId);
      if (hub !== organizationId && shift.organizationId !== organizationId) continue;
      const outletCode = shift.register?.outlet?.code?.trim();
      if (!outletCode) continue;
      open.push({
        outletCode,
        shiftId: shift.id,
        openedAt: shift.openedAt.toISOString(),
      });
    }
    return NextResponse.json({ open });
  } catch (err) {
    console.error("[retail shifts/open]", err);
    return NextResponse.json({ error: "Open shift list failed" }, { status: 500 });
  }
}
