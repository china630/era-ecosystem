import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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

import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CheckContractLimitDto } from "./dto/check-contract-limit.dto";
import { CreateContractDto } from "./dto/create-contract.dto";
import { PatchContractDto } from "./dto/patch-contract.dto";
import { ContractsService } from "./contracts.service";

@ApiTags("contracts")
@ApiBearerAuth("bearer")
@Controller("contracts")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.CONTRACT_MANAGEMENT_PRO)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List contracts" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.contracts.list(organizationId, { page, pageSize });
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Create contract (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.contracts.create(organizationId, dto);
  }

  @Post("check-limit")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({
    summary:
      "Hard-block check: ACTIVE status, dateTo not expired, amount limit vs commitments",
  })
  checkLimit(
    @OrganizationId() organizationId: string,
    @Body() dto: CheckContractLimitDto,
  ) {
    return this.contracts.checkLimit(dto.contractId, dto.amount, organizationId);
  }

  @Get(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Get contract" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.contracts.get(organizationId, id);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Update contract" })
  patch(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: PatchContractDto,
  ) {
    return this.contracts.patch(organizationId, id, dto);
  }

  @Post(":id/activate")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Activate contract" })
  activate(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.contracts.activate(organizationId, id);
  }
}
