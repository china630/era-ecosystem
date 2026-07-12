import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { EmasContractService } from "./emas-contract.service";
import { EmasHireDto } from "./dto/emas-hire.dto";
import { EmasTransferDto } from "./dto/emas-transfer.dto";
import { EmasTerminateDto } from "./dto/emas-terminate.dto";

@ApiTags("hr-emas")
@ApiBearerAuth("bearer")
@Controller("hr/employees")
export class EmasController {
  constructor(private readonly emas: EmasContractService) {}

  @Get(":id/emas/events")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "ƏMAS contract lifecycle events for employee" })
  listEvents(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
  ) {
    return this.emas.listEvents(organizationId, employeeId);
  }

  @Post(":id/emas/hire")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({
    summary: "Push hire contract to ƏMAS (ERA_EMAS_S2S_ENABLED; else 503 → RPA/Excel)",
  })
  hire(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasHireDto,
  ) {
    return this.emas.submitHire(organizationId, employeeId, dto);
  }

  @Post(":id/emas/transfer")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Push transfer event to ƏMAS S2S" })
  transfer(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasTransferDto,
  ) {
    return this.emas.submitTransfer(organizationId, employeeId, dto);
  }

  @Post(":id/emas/terminate")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Push termination event to ƏMAS S2S" })
  terminate(
    @OrganizationId() organizationId: string,
    @Param("id") employeeId: string,
    @Body() dto: EmasTerminateDto,
  ) {
    return this.emas.submitTerminate(organizationId, employeeId, dto);
  }
}
