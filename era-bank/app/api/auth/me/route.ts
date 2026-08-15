import { sessionIsPlatformSuperAdmin } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { getRouteSession, jsonError } from "@/lib/api-utils";

export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);

  const user = await prisma.opsUser.findUnique({
    where: { id: session.sub },
    include: { opsRole: true },
  });
  if (!user) return jsonError("User not found", 404);

  const limits = (user.opsRole.limitsJson ?? {}) as Record<string, unknown>;
  // Platform super-admins always have full bank ops access (incl. approvals).
  const isPlatformSuperAdmin = sessionIsPlatformSuperAdmin(session);

  return Response.json({
    id: user.id,
    login: user.username,
    fullName: user.fullName,
    role: user.opsRole.code,
    branchId: user.branchId,
    canApprove: isPlatformSuperAdmin || limits.canApprove === true,
    limitsJson: limits,
    isPlatformSuperAdmin,
    organizationName: process.env.ERA_BANK_ORGANIZATION_NAME ?? "ERA Bank",
  });
}
