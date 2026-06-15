import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsArray, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { ServiceTokenGuard } from "../auth/bank-auth.guard";
import { OrchestratorEventsPublisher } from "./orchestrator-events.publisher";

class StaffProvisioningDto {
  @IsString()
  staffUserId!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
}

class GlSummaryLineDto {
  @IsString()
  glCode!: string;

  @IsNumber()
  debit!: number;

  @IsNumber()
  credit!: number;
}

class FinanceBridgeSummaryDto {
  @IsString()
  businessDate!: string;

  @IsArray()
  lines!: GlSummaryLineDto[];
}

@ApiTags("internal")
@ApiBearerAuth("service-token")
@UseGuards(ServiceTokenGuard)
@Controller("internal/v1")
export class FinanceBridgeController {
  constructor(private readonly events: OrchestratorEventsPublisher) {}

  /** Inbound HR provisioning hook (STAFF_PROVISIONED family). MVP: acknowledge only. */
  @Post("staff-provisioning")
  staffProvisioning(@Body() dto: StaffProvisioningDto) {
    return {
      accepted: true,
      staffUserId: dto.staffUserId,
      note: "MVP stub — wire to ops user provisioning in production",
    };
  }

  /** Push summarized corporate journal lines to finance via event bus. */
  @Post("finance-bridge/summary")
  async pushGlSummary(@Body() dto: FinanceBridgeSummaryDto) {
    return this.events.publishGlDailySummary({
      businessDate: dto.businessDate,
      lines: dto.lines.map((l) => ({
        glCode: l.glCode,
        debit: l.debit,
        credit: l.credit,
      })),
    });
  }
}
