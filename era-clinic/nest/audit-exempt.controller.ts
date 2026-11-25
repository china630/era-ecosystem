import { Controller, Get, HttpCode, HttpException, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES,
  setOrgAuditExemptPrefixes,
} from "@era/satellite-kit";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withClinicStaff } from "./bridge";
import { ClinicApiGuard, readClinicSession } from "./native/clinic-api.guard";

const bodySchema = z.object({
  prefixes: z.array(z.string().trim().min(1).max(200)).max(50),
});

function rememberOrgAuditExemptPrefixes(
  organizationId: string,
  prefixes: readonly string[] | null | undefined,
): void {
  if (typeof setOrgAuditExemptPrefixes === "function") {
    setOrgAuditExemptPrefixes(organizationId, prefixes);
  }
}

function clean(prefixes: string[]): string[] {
  return [...new Set(prefixes.map((item) => item.trim()).filter((item) => item.startsWith("/api/")))];
}

export async function loadClinicAuditExemptCache(): Promise<void> {
  // SHARED boot clears the process bind. The tenant extension cannot list every org.
  const base = new PrismaClient();
  try {
    const rows = await base.tenant.findMany({
      select: { organizationId: true, auditExemptPrefixes: true },
    });
    for (const row of rows) {
      rememberOrgAuditExemptPrefixes(row.organizationId, row.auditExemptPrefixes);
    }
  } finally {
    await base.$disconnect();
  }
}

@Controller()
@UseGuards(ClinicApiGuard)
export class AuditExemptController {
  @Get("api/admin/audit-exempt")
  @HttpCode(200)
  async get(@Req() req: object) {
    const session = readClinicSession(req);
    return withClinicStaff(req as never, session, async () => {
      if (!session.organizationId) throw new HttpException({ error: "Unauthorized" }, 401);
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

  @Put("api/admin/audit-exempt")
  @HttpCode(200)
  async put(@Req() req: { body?: unknown }) {
    const session = readClinicSession(req);
    return withClinicStaff(req as never, session, async () => {
      if (!session.organizationId) throw new HttpException({ error: "Unauthorized" }, 401);
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) throw new HttpException({ error: "Invalid prefixes" }, 400);
      const prefixes = clean(parsed.data.prefixes);
      await prisma.tenant.updateMany({
        where: { organizationId: session.organizationId },
        data: { auditExemptPrefixes: prefixes },
      });
      rememberOrgAuditExemptPrefixes(session.organizationId, prefixes);
      return {
        prefixes,
        usingDefault: prefixes.length === 0,
        defaults: [...DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES],
      };
    });
  }
}
