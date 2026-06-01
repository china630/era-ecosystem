import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return jsonError("Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        fullName: true,
        role: { select: { code: true } },
      },
    });
    if (!user) return jsonError("User not found", 404);

    return jsonOk(user);
  } catch (err) {
    return handleRouteError(err);
  }
}
