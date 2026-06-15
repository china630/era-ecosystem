import {
  authCookieName,
  hashPassword,
  signSatelliteSession,
  verifyPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const username = body.login.trim();

    const user = await prisma.opsUser.findFirst({
      where: { username },
      include: { opsRole: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return jsonError("Invalid credentials", 401);
    }
    if (!user.passwordHash || user.passwordHash === "sso:no-password") {
      return jsonError("Invalid credentials", 401);
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }

    await prisma.opsSession.create({
      data: {
        opsUserId: user.id,
        branchId: user.branchId,
      },
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      role: user.opsRole.code,
      fullName: user.fullName,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: user.opsRole.code,
        branchId: user.branchId,
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
