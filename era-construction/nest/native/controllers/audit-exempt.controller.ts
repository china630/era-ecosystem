import { Body, Controller, Get, HttpCode, HttpException, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES,
  setOrgAuditExemptPrefixes,
} from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const bodySchema = z.object({
  prefixes: z.array(z.string().trim().min(1).max(200)).max(50),
});

function clean(prefixes: string[]): string[] {
  return [...new Set(prefixes.map((item) => item.trim()).filter((item) => item.startsWith("/api/")))];
}

export async function loadConstructionAuditExemptCache(): Promise<void> {
  const rows = await prisma.tenant.findMany({
    select: { organizationId: true, auditExemptPrefixes: true },
  });
  for (const row of rows) {
    setOrgAuditExemptPrefixes(row.organizationId, row.auditExemptPrefixes);
  }
}

@Controller("api/admin/audit-exempt")
@UseGuards(ConstructionStaffGuard)
export class AuditExemptController {
  @Get()
  @HttpCode(200)
  get(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
      const tenant = await prisma.tenant.findFirst({
        where: { organizationId: session.organizationId },
        select: { auditExemptPrefixes: true },
      });
      const prefixes = tenant?.auditExemptPrefixes ?? [];
      return {
        prefixes,
        usingDefault: prefixes.length === 0,
        defaults: [...DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES],
      };
    });
  }

  @Put()
  @HttpCode(200)
  put(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        throw new HttpException({ error: "Invalid prefixes" }, 400);
      }
      const prefixes = clean(parsed.data.prefixes);
      await prisma.tenant.updateMany({
        where: { organizationId: session.organizationId },
        data: { auditExemptPrefixes: prefixes },
      });
      setOrgAuditExemptPrefixes(session.organizationId, prefixes);
      return {
        prefixes,
        usingDefault: prefixes.length === 0,
        defaults: [...DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES],
      };
    });
  }
}
