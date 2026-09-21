import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { AccountsService } from "./accounts.service";
import { CreateAccountMappingDto } from "./dto/create-account-mapping.dto";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { legacyMappingGone } from "../accounting/ledger-mapping.controller";

@ApiTags("account-mappings")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.IFRS_MAPPING)
@Controller("account-mappings")
export class AccountMappingsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: "Legacy list — prefer /accounting/ledger-mappings" })
  list(@OrganizationId() organizationId: string) {
    return this.accounts.listMappings(organizationId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Gone — use /accounting/ledger-mappings" })
  create(
    @OrganizationId() _organizationId: string,
    @Body() _dto: CreateAccountMappingDto,
  ) {
    return legacyMappingGone();
  }

  @Delete(":id")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Gone — use /accounting/ledger-mappings" })
  remove(
    @OrganizationId() _organizationId: string,
    @Param("id", ParseUUIDPipe) _id: string,
  ) {
    return legacyMappingGone();
  }
}
