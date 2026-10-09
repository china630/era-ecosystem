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

/** Hotel night audit asks which outlets still have a live open shift. */
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
    const shifts = await prisma.posShift.findMany({
      where: { status: "OPEN", organizationId },
      include: { outlet: true },
      orderBy: { openedAt: "asc" },
    });
    return NextResponse.json({
      open: shifts
        .filter((shift) => shift.outlet?.code)
        .map((shift) => ({
          outletCode: shift.outlet.code,
          shiftId: shift.id,
          openedAt: shift.openedAt.toISOString(),
        })),
    });
  } catch (err) {
    console.error("[shifts/open]", err);
    return NextResponse.json({ error: "Open shift list failed" }, { status: 500 });
  }
}
