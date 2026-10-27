import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { OrganizationId } from "../common/org-id.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { AdminAuditLogsService } from "./audit.service";
import { AdminAuditLogsQueryDto } from "./dto/admin-audit-logs-query.dto";

/**
 * OWNER security journal — UI `/admin/security-audit` → `GET /api/admin/security-audit`.
 * Not SuperAdmin platform admin; org-scoped only.
 */
@ApiTags("admin-security-audit")
@ApiBearerAuth("bearer")
@Controller("admin/security-audit")
@UseGuards(JwtAuthGuard)
export class AdminSecurityAuditController {
  constructor(private readonly adminAuditLogs: AdminAuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: "Security audit log (OWNER only): filters + pagination",
  })
  async list(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Query() q: AdminAuditLogsQueryDto,
  ) {
    if (!user.isOwner && !user.isSuperAdmin) {
      throw new ForbiddenException("OWNER only");
    }
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
    const dateFrom = q.dateFrom?.trim() || q.from?.trim() || undefined;
    const dateTo = q.dateTo?.trim() || q.to?.trim() || undefined;
    let fromIso = dateFrom;
    let toIso = dateTo;
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      fromIso = bakuDayBounds(dateFrom).start.toISOString();
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      toIso = bakuDayBounds(dateTo).end.toISOString();
    }
    return this.adminAuditLogs.listAuditLogs(organizationId, {
      userId: q.userId,
      entityName: q.entityName?.trim() || undefined,
      entityId: q.entityId?.trim() || undefined,
      from: fromIso,
      to: toIso,
      page,
      pageSize,
    });
  }
}
