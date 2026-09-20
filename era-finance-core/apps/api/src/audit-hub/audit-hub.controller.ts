import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { Request, Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { AuditBulkExportService } from "./audit-bulk-export.service";
import { AuditEngagementInviteService } from "./audit-engagement-invite.service";
import { AuditEngagementService } from "./audit-engagement.service";
import { AuditHubBackdatingService } from "./audit-hub-backdating.service";
import { AuditHubCalculationService } from "./audit-hub-calculation.service";
import { AuditHubNasIfrsService } from "./audit-hub-nas-ifrs.service";
import { AuditHubRiskService } from "./audit-hub-risk.service";
import { AuditHubSummaryService } from "./audit-hub-summary.service";
import { AuditSamplingService } from "./audit-sampling.service";
import { AuditTimelineService } from "./audit-timeline.service";
import type { AuditHubBulkExportDto } from "./dto/bulk-export.dto";
import type { BackdatingQueryDto } from "./dto/backdating-query.dto";
import { CreateAuditEngagementDto } from "./dto/create-audit-engagement.dto";
import { CreateAuditEngagementInviteDto } from "./dto/create-audit-engagement-invite.dto";
import type { CreateAuditSampleDto } from "./dto/create-audit-sample.dto";
import type { ListAuditHubTimelineQueryDto } from "./dto/list-audit-hub-timeline.dto";
import { NasIfrsQueryDto } from "./dto/nas-ifrs-query.dto";
import { PatchAuditEngagementStatusDto } from "./dto/patch-audit-engagement-status.dto";
import { AuditHubRiskQueryDto } from "./dto/risk-query.dto";

@ApiTags("audit-hub")
@ApiBearerAuth("bearer")
@Controller("audit-hub")
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.AUDIT_HUB)
export class AuditHubController {
  constructor(
    private readonly timeline: AuditTimelineService,
    private readonly backdating: AuditHubBackdatingService,
    private readonly sampling: AuditSamplingService,
    private readonly bulkExportService: AuditBulkExportService,
    private readonly summary: AuditHubSummaryService,
    private readonly nasIfrs: AuditHubNasIfrsService,
    private readonly risk: AuditHubRiskService,
    private readonly calculation: AuditHubCalculationService,
    private readonly engagements: AuditEngagementService,
    private readonly engagementInvites: AuditEngagementInviteService,
  ) {}

  @Get("summary")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Dashboard KPIs for Audit Hub" })
  getSummary(@OrganizationId() organizationId: string) {
    return this.summary.getSummary(organizationId);
  }

  @Get("timeline")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary:
      "Merged AuditLog + EntityActivity for an entity, or org-wide AuditLog",
  })
  getTimeline(
    @OrganizationId() organizationId: string,
    @Query() query: ListAuditHubTimelineQueryDto,
  ) {
    return this.timeline.getTimeline(organizationId, query);
  }

  @Get("backdating")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Document date vs system entry date gaps" })
  getBackdating(
    @OrganizationId() organizationId: string,
    @Query() query: BackdatingQueryDto,
  ) {
    return this.backdating.report(organizationId, query);
  }

  @Get("reconciliation/nas-ifrs")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary:
      "Default-ops book vs each ACTIVE non-ops book: presence and debit parity",
  })
  getNasIfrsReconciliation(
    @OrganizationId() organizationId: string,
    @Query() query: NasIfrsQueryDto,
  ) {
    return this.nasIfrs.report(organizationId, query);
  }

  @Get("risk")
  @Throttle({ default: { limit: 45, ttl: 60_000 } })
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary: "Heuristic risk detectors (duplicate cash orders, …)",
  })
  getRisk(
    @OrganizationId() organizationId: string,
    @Query() query: AuditHubRiskQueryDto,
  ) {
    return this.risk.report(organizationId, query);
  }

  @Get("calculation/:type/:id")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Explain posting / document (v1 JSON)" })
  getCalculation(
    @OrganizationId() organizationId: string,
    @Param("type") type: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.calculation.explain(organizationId, type, id);
  }

  @Get("engagements")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "List named audit engagements" })
  listEngagements(@OrganizationId() organizationId: string) {
    return this.engagements.list(organizationId);
  }

  @Post("engagements")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Create audit engagement" })
  createEngagement(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAuditEngagementDto,
  ) {
    return this.engagements.create(organizationId, user.userId, dto);
  }

  @Patch("engagements/:id/status")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Update engagement status" })
  patchEngagementStatus(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: PatchAuditEngagementStatusDto,
  ) {
    return this.engagements.updateStatus(
      organizationId,
      user.userId,
      id,
      dto.status,
    );
  }

  @Post("engagements/invites")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Invite external auditor (token returned once)" })
  createEngagementInvite(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAuditEngagementInviteDto,
  ) {
    return this.engagementInvites.createInvite(
      organizationId,
      user.userId,
      dto,
    );
  }

  @Get("engagements/invites/outbox")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "List invites issued for this organization" })
  listEngagementInvitesOutbox(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.engagementInvites.listOutgoingForOrganization(
      organizationId,
      user.userId,
    );
  }

  @Post("engagements/invites/:id/revoke")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Revoke a pending or accepted invite" })
  revokeEngagementInvite(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.engagementInvites.revokeInvite(
      organizationId,
      user.userId,
      id,
    );
  }

  @Get("engagements/:id")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Get one audit engagement by id" })
  getEngagement(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.engagements.getById(organizationId, id);
  }

  @Post("sampling")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Create a reproducible audit sample" })
  createSampling(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAuditSampleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sampling.createSample(
      organizationId,
      user.userId,
      dto,
    );
  }

  @Get("sampling/:id")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Get saved audit sample by id" })
  getSampling(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.sampling.getSample(organizationId, id);
  }

  @Post("bulk-export")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "ZIP attachments for a saved sample" })
  async postBulkExport(
    @OrganizationId() organizationId: string,
    @Body() dto: AuditHubBulkExportDto,
    @Res({ passthrough: false }) res: Response,
    @Req() req: Request & RequestWithAuditEngagement,
  ): Promise<void> {
    if (
      req.auditEngagementEffectiveOrgId &&
      req.auditEngagementInvitePermissions?.auditBulkExport !== true
    ) {
      throw new ForbiddenException({
        code: "AUDIT_ENGAGEMENT_BULK_EXPORT_DENIED",
        message: "Bulk export is not permitted for this engagement.",
      });
    }
    const guest = Boolean(req.auditEngagementEffectiveOrgId);
    await this.bulkExportService.streamZip(organizationId, dto, res, {
      guest,
    });
  }
}
