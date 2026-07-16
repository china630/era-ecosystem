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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CreateContractDto } from "./dto/create-contract.dto";
import { PatchContractDto } from "./dto/patch-contract.dto";
import { ContractsService } from "./contracts.service";

@ApiTags("contracts")
@ApiBearerAuth("bearer")
@Controller("contracts")
@UseGuards(SubscriptionGuard, RolesGuard)
@RequiresModule(ModuleEntitlement.CONTRACT_MANAGEMENT_PRO)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "List contracts" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.contracts.list(organizationId, { page, pageSize });
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create contract (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.contracts.create(organizationId, dto);
  }

  @Get(":id")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "Get contract" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.contracts.get(organizationId, id);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update contract" })
  patch(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: PatchContractDto,
  ) {
    return this.contracts.patch(organizationId, id, dto);
  }

  @Post(":id/activate")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Activate contract" })
  activate(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.contracts.activate(organizationId, id);
  }
}
