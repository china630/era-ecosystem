import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DisputeSeverity, DisputeStatus } from "@era365/database";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { DisputeService } from "./dispute.service";

class OpenDisputeDto {
  claimantUserId!: string;
  incumbentUserId!: string;
  evidenceKeys?: string[];
  severity?: DisputeSeverity;
}

class PatchDisputeStatusDto {
  status!: DisputeStatus;
}

class CounterClaimDto {
  token!: string;
  note!: string;
}

@Controller()
export class DisputeAdminController {
  constructor(private readonly dispute: DisputeService) {}

  @Post("admin/organizations/:organizationId/disputes")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  open(
    @Param("organizationId") organizationId: string,
    @Body() dto: OpenDisputeDto,
  ) {
    return this.dispute.openDispute({
      organizationId,
      claimantUserId: dto.claimantUserId,
      incumbentUserId: dto.incumbentUserId,
      evidenceKeys: dto.evidenceKeys,
      severity: dto.severity,
    });
  }

  @Get("admin/organizations/:organizationId/disputes")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  list(@Param("organizationId") organizationId: string) {
    return this.dispute.listForOrganization(organizationId);
  }

  @Get("admin/organizations/:organizationId/security-state")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  securityState(@Param("organizationId") organizationId: string) {
    return this.dispute.getSecurityState(organizationId);
  }

  @Patch("admin/organizations/:organizationId/disputes/:disputeId/status")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  patchStatus(
    @Param("organizationId") organizationId: string,
    @Param("disputeId") disputeId: string,
    @Body() dto: PatchDisputeStatusDto,
  ) {
    return this.dispute.patchDisputeStatus(
      organizationId,
      disputeId,
      dto.status,
    );
  }

  @Post("admin/organizations/:organizationId/disputes/:disputeId/notify")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  notify(@Param("disputeId") disputeId: string) {
    return this.dispute.notifyIncumbent(disputeId);
  }

  @Post("admin/organizations/:organizationId/disputes/:disputeId/execute")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  execute(
    @CurrentUser() user: EraJwtPayload,
    @Param("disputeId") disputeId: string,
  ) {
    return this.dispute.executeTransfer(disputeId, user.sub);
  }
}

@Controller()
export class DisputePublicController {
  constructor(private readonly dispute: DisputeService) {}

  @Get("public/disputes/:id/meta")
  meta(@Param("id") id: string, @Query("t") token: string) {
    return this.dispute.getPublicDisputeMeta(id, token);
  }

  @Post("public/disputes/:id/counter-claim")
  counterClaim(@Param("id") id: string, @Body() dto: CounterClaimDto) {
    return this.dispute.recordCounterClaim(id, dto.token, dto.note);
  }
}
