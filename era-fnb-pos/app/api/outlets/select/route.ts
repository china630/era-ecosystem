import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const bodySchema = z.object({
  outletId: z.string().min(1),
});

export async function POST(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
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
  const res = NextResponse.json({ ok: true, outletId: outlet.id, code: outlet.code });
  res.cookies.set(OUTLET_COOKIE, outlet.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
