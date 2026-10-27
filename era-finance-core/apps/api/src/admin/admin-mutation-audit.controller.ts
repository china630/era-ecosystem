import { CP_PERMISSION } from "@era/contracts";
import { bakuDayBounds } from "@era/satellite-kit/time";
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Prisma } from "@erafinance/database";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function dateRangeFromQuery(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined {
  const fromYmd = dateFrom?.trim().slice(0, 10);
  const toYmd = dateTo?.trim().slice(0, 10);
  if (!fromYmd && !toYmd) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (fromYmd) range.gte = bakuDayBounds(fromYmd).start;
  if (toYmd) range.lte = bakuDayBounds(toYmd).end;
  return range;
}

/**
 * Org mutation journal — UI `/admin/audit` → `GET /api/admin/audit`.
 * ADR era-mutation-audit-standard (Layer A/B org viewer).
 */
@ApiTags("admin-mutation-audit")
@ApiBearerAuth("bearer")
@Controller("admin/audit")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(CP_PERMISSION.API_LEDGER_READ)
export class AdminMutationAuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Org mutation audit log (Layer A HTTP_MUTATION + Layer B). Filters: entityType, entityId, action, dateFrom, dateTo, userId, page, pageSize",
  })
  async list(
    @OrganizationId() organizationId: string,
    @Query("userId") userId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("action") action?: string,
    @Query("take") takeRaw?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = { organizationId };
    if (userId?.trim()) where.userId = userId.trim();
    const createdAt = dateRangeFromQuery(dateFrom, dateTo);
    if (createdAt) where.createdAt = createdAt;
    if (entityType?.trim()) where.entityType = entityType.trim();
    if (entityId?.trim()) where.entityId = entityId.trim();
    if (action?.trim()) where.action = action.trim();

    const userSelect = {
      id: true,
      email: true,
      firstNameCipher: true,
      lastNameCipher: true,
    } as const;

    const page = Math.max(1, Number.parseInt(pageRaw ?? "0", 10) || 0);
    const pageSizeParsed = Number.parseInt(pageSizeRaw ?? "0", 10) || 0;
    if (page > 0 && pageSizeParsed > 0) {
      const pageSize = Math.min(100, Math.max(1, pageSizeParsed));
      const skip = (page - 1) * pageSize;
      const [total, items] = await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
          include: { user: { select: userSelect } },
        }),
      ]);
      return { items, total, page, pageSize };
    }

    const take = Math.min(
      100,
      Math.max(1, Number.parseInt(takeRaw ?? "50", 10) || 50),
    );
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: userSelect } },
    });
    return { items, total: items.length, page: 1, pageSize: take };
  }

  @Post("integrity-check")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Verify audit_logs hashes for organization" })
  async integrityCheck(@OrganizationId() organizationId: string) {
    return this.audit.verifyOrganizationLogs(organizationId);
  }

  @Post("verify-chain")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Verify audit_logs hash-chain" })
  async verifyChain(@OrganizationId() organizationId: string) {
    return this.audit.verifyOrganizationChain(organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "One org audit log row" })
  async one(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstNameCipher: true,
            lastNameCipher: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Audit log not found");
    return row;
  }
}
