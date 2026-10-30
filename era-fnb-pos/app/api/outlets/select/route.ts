import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { capabilitiesFromOutletRow } from "@/lib/outlet-capabilities";

const bodySchema = z.object({
  outletId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (session?.pin === true) {
      return NextResponse.json(
        { error: "Forbidden: PIN session cannot rebind outlet" },
        { status: 403 },
      );
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLET_BIND);
    if (denied) return denied;
    const body = bodySchema.parse(await request.json());
    const outlet = await prisma.outlet.findUnique({ where: { id: body.outletId } });
    if (!outlet?.active) {
      return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
    }
    const capabilities = capabilitiesFromOutletRow(outlet);
    const res = jsonOk({
      ok: true,
      outletId: outlet.id,
      code: outlet.code,
      capabilities,
    });
    res.cookies.set(OUTLET_COOKIE, outlet.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
