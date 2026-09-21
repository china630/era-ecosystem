import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationId } from "../common/org-id.decorator";
import {
  CreateAccountSubcontoConfigDto,
  CreateSubcontoTypeDto,
  UpdateAccountSubcontoConfigDto,
  UpdateSubcontoTypeDto,
} from "./dto/subconto.dto";
import { SubcontoService } from "./subconto.service";

@ApiTags("accounting")
@ApiBearerAuth("bearer")
@Controller("accounting/subconto")
@UseGuards(JwtAuthGuard)
export class SubcontoController {
  constructor(private readonly subconto: SubcontoService) {}

  @Get("feature-status")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "ERA_SUBCONTO_ENABLED feature flag status" })
  featureStatus() {
    return this.subconto.getFeatureStatus();
  }

  @Post("seed-system-types")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Seed system subconto types (COUNTERPARTY, COST_CENTER, …)" })
  seedSystemTypes(@OrganizationId() organizationId: string) {
    return this.subconto.seedSystemTypes(organizationId);
  }

  @Post("backfill-from-transactions")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({
    summary:
      "Backfill JournalEntryDimension from Transaction counterpartyId/departmentId (idempotent)",
  })
  backfillFromTransactions(@OrganizationId() organizationId: string) {
    return this.subconto.backfillFromTransactions(organizationId);
  }

  @Get("types")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List subconto types for organization" })
  listTypes(@OrganizationId() organizationId: string) {
    return this.subconto.listTypes(organizationId);
  }

  @Post("types")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Create custom subconto type" })
  createType(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateSubcontoTypeDto,
  ) {
    return this.subconto.createType(organizationId, dto);
  }

  @Patch("types/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Update subconto type name" })
  updateType(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSubcontoTypeDto,
  ) {
    return this.subconto.updateType(organizationId, id, dto);
  }

  @Delete("types/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Delete custom subconto type" })
  deleteType(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.subconto.deleteType(organizationId, id);
  }

  @Get("account-configs")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List account subconto configs (optional accountId filter)" })
  listAccountConfigs(
    @OrganizationId() organizationId: string,
    @Query("accountId") accountId?: string,
  ) {
    return this.subconto.listAccountConfigs(organizationId, accountId?.trim());
  }

  @Post("account-configs")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Bind subconto type to account (max 3 per account)" })
  createAccountConfig(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAccountSubcontoConfigDto,
  ) {
    return this.subconto.createAccountConfig(organizationId, dto);
  }

  @Patch("account-configs/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Update account subconto config" })
  updateAccountConfig(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAccountSubcontoConfigDto,
  ) {
    return this.subconto.updateAccountConfig(organizationId, id, dto);
  }

  @Delete("account-configs/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Remove account subconto config" })
  deleteAccountConfig(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.subconto.deleteAccountConfig(organizationId, id);
  }
}
