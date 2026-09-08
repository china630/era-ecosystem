import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { AccountsService } from "./accounts.service";
import { CreateIfrsMappingRuleDto } from "./dto/create-ifrs-mapping-rule.dto";
import { UpdateIfrsMappingRuleDto } from "./dto/update-ifrs-mapping-rule.dto";
import { legacyMappingGone } from "../accounting/ledger-mapping.controller";

@ApiTags("ifrs-mapping-rules")
@ApiBearerAuth("bearer")
@UseGuards(RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller("ifrs-mapping-rules")
export class IfrsMappingRulesController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: "Legacy list — prefer /accounting/ledger-mappings" })
  list(@OrganizationId() organizationId: string) {
    return this.accounts.listIfrsMappingRules(organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Gone — use /accounting/ledger-mappings" })
  create(
    @OrganizationId() _organizationId: string,
    @Body() _dto: CreateIfrsMappingRuleDto,
  ) {
    return legacyMappingGone();
  }

  @Patch(":id")
  @ApiOperation({ summary: "Gone — use /accounting/ledger-mappings" })
  update(
    @OrganizationId() _organizationId: string,
    @Param("id", ParseUUIDPipe) _id: string,
    @Body() _dto: UpdateIfrsMappingRuleDto,
  ) {
    return legacyMappingGone();
  }

  @Delete(":id")
  @ApiOperation({ summary: "Gone — use /accounting/ledger-mappings" })
  remove(
    @OrganizationId() _organizationId: string,
    @Param("id", ParseUUIDPipe) _id: string,
  ) {
    return legacyMappingGone();
  }
}
