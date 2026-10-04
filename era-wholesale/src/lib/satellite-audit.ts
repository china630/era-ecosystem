import { auditMutation, type SatelliteAuditWriter } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

const writeAudit: SatelliteAuditWriter = async (row) => {
  await prisma.satelliteAuditLog.create({
    data: { ...row, organizationId: requestOrganizationId() },
  });
};

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function recordAudit(
  ctx: { userId?: string | null; request?: Request },
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  await auditMutation(
    writeAudit,
    {
      userId: ctx.userId,
      ipAddress: ctx.request ? clientIp(ctx.request) : null,
    },
    entityType,
    entityId,
    action,
    changes,
  );
}
