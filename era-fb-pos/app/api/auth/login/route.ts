import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const schema = z.object({ login: z.string().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { login: body.login },
      include: { role: true },
    });
    if (!user || user.passwordHash === "sso:no-password") {
      return jsonError("Invalid credentials", 401);
    }
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
    });
    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
      },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
