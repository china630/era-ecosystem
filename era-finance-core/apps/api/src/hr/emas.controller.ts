import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { EmasContractService } from "./emas-contract.service";
import { EmasHireDto } from "./dto/emas-hire.dto";
import { EmasTransferDto } from "./dto/emas-transfer.dto";
import { EmasTerminateDto } from "./dto/emas-terminate.dto";

class MarkEmasManualDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@ApiTags("hr-emas")
@ApiBearerAuth("bearer")
@Controller("hr")
export class EmasController {
  constructor(private readonly emas: EmasContractService) {}

  @Get("emas/queue")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Org-scoped ƏMAS manual queue (PENDING_MANUAL / SUBMITTED_MANUAL). Wave 7 — no S2S required.",
  })
  listQueue(
    @OrganizationId() organizationId: string,
    @Query("status") status?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.emas.listQueue(organizationId, {
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get("emas/s2s-status")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Whether ƏMAS S2S gateway is configured (ERA_EMAS_S2S_ENABLED + EMAS_SUBMIT_URL)",
  })
  s2sStatus() {
    return { s2sConfigured: this.emas.isS2sConfigured() };
  }

  @Get("emas/queue/export.csv")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="emas-queue.csv"')
  @ApiOperation({
    summary:
      "Excel/CSV export of PENDING_MANUAL queue (contract salary only — never internalRate)",
  })
  async exportQueue(@OrganizationId() organizationId: string) {
    return this.emas.exportQueueCsv(organizationId);
  }

  @Patch("emas/queue/:eventId/mark-submitted")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "HR marks portal upload done (SUBMITTED_MANUAL). Not a legal filing claim.",
  })
  markSubmitted(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("eventId") eventId: string,
    @Body() dto: MarkEmasManualDto,
  ) {
    return this.emas.markSubmittedManual(
      organizationId,
      eventId,
      user.userId,
      dto.note,
    );
  }

  @Get("employees/:id/emas/events")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "ƏMAS contract lifecycle events for employee" })
  listEvents(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
  ) {
    return this.emas.listEvents(organizationId, employeeId);
  }

  @Post("employees/:id/emas/hire")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Push hire contract to ƏMAS S2S (ERA_EMAS_S2S_ENABLED + EMAS_SUBMIT_URL; else 503 → RPA/Excel)",
  })
  hire(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasHireDto,
  ) {
    return this.emas.submitHire(organizationId, employeeId, dto);
  }

  @Post("employees/:id/emas/transfer")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Push transfer event to ƏMAS S2S" })
  transfer(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasTransferDto,
  ) {
    return this.emas.submitTransfer(organizationId, employeeId, dto);
  }

  @Post("employees/:id/emas/terminate")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Push termination event to ƏMAS S2S" })
  terminate(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasTerminateDto,
  ) {
    return this.emas.submitTerminate(organizationId, employeeId, dto);
  }
}
