import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OUTLET_COOKIE } from "@/lib/outlet-session";

const bodySchema = z.object({
  outletId: z.string().min(1),
});

export async function POST(request: Request) {
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
