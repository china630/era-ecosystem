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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontoController {
  constructor(private readonly subconto: SubcontoService) {}

  @Get("feature-status")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "ERA_SUBCONTO_ENABLED feature flag status" })
  featureStatus() {
    return this.subconto.getFeatureStatus();
  }

  @Post("seed-system-types")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Seed system subconto types (COUNTERPARTY, COST_CENTER, BRANCH, …)" })
  seedSystemTypes(@OrganizationId() organizationId: string) {
    return this.subconto.seedSystemTypes(organizationId);
  }

  @Post("seed-branch")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Seed BRANCH custom subconto (multi-branch Poçt/Rabitə/Teleötürücü valueRef catalog)",
  })
  seedBranch(@OrganizationId() organizationId: string) {
    return this.subconto.seedBranchType(organizationId);
  }

  @Get("branch-value-refs")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List canonical BRANCH valueRef codes" })
  branchValueRefs() {
    return this.subconto.listBranchValueRefs();
  }

  @Post("backfill-from-transactions")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Backfill JournalEntryDimension from Transaction counterpartyId/departmentId (idempotent)",
  })
  backfillFromTransactions(@OrganizationId() organizationId: string) {
    return this.subconto.backfillFromTransactions(organizationId);
  }

  @Get("types")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List subconto types for organization" })
  listTypes(@OrganizationId() organizationId: string) {
    return this.subconto.listTypes(organizationId);
  }

  @Post("types")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create custom subconto type" })
  createType(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateSubcontoTypeDto,
  ) {
    return this.subconto.createType(organizationId, dto);
  }

  @Patch("types/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update subconto type name" })
  updateType(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSubcontoTypeDto,
  ) {
    return this.subconto.updateType(organizationId, id, dto);
  }

  @Delete("types/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Delete custom subconto type" })
  deleteType(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.subconto.deleteType(organizationId, id);
  }

  @Get("account-configs")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List account subconto configs (optional accountId filter)" })
  listAccountConfigs(
    @OrganizationId() organizationId: string,
    @Query("accountId") accountId?: string,
  ) {
    return this.subconto.listAccountConfigs(organizationId, accountId?.trim());
  }

  @Post("account-configs")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Bind subconto type to account (max 3 per account)" })
  createAccountConfig(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAccountSubcontoConfigDto,
  ) {
    return this.subconto.createAccountConfig(organizationId, dto);
  }

  @Patch("account-configs/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update account subconto config" })
  updateAccountConfig(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAccountSubcontoConfigDto,
  ) {
    return this.subconto.updateAccountConfig(organizationId, id, dto);
  }

  @Delete("account-configs/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Remove account subconto config" })
  deleteAccountConfig(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.subconto.deleteAccountConfig(organizationId, id);
  }
}
