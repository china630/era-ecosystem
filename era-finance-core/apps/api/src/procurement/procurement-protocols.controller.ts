import { CP_PERMISSION } from "@era/contracts";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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

import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { AwardProcurementProtocolDto } from "./dto/award-protocol.dto";
import {
  CreateProcurementProtocolDto,
  UpdateProcurementProtocolDto,
} from "./dto/procurement-protocol.dto";
import { ProcurementProtocolsService } from "./procurement-protocols.service";

@ApiTags("procurement-protocols")
@ApiBearerAuth("bearer")
@Controller("procurement/protocols")
@UseGuards(PermissionsGuard)
export class ProcurementProtocolsController {
  constructor(private readonly protocols: ProcurementProtocolsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "List procurement protocols" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.protocols.list(organizationId, { page, pageSize });
  }

  @Post()
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Create procurement protocol (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateProcurementProtocolDto,
  ) {
    return this.protocols.create(organizationId, dto);
  }

  @Get(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Get procurement protocol" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.get(organizationId, id);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Update procurement protocol" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementProtocolDto,
  ) {
    return this.protocols.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Delete DRAFT procurement protocol" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.remove(organizationId, id);
  }

  @Post(":id/register")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Register protocol (DRAFT → REGISTERED)" })
  register(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.register(organizationId, id);
  }

  @Post(":id/open")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.PROCUREMENT_TENDERS_PRO)
  @ApiOperation({ summary: "Open tender (DRAFT/REGISTERED → OPEN)" })
  open(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.open(organizationId, id);
  }

  @Post(":id/award")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.PROCUREMENT_TENDERS_PRO)
  @ApiOperation({ summary: "Award winner → draft Contract" })
  award(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AwardProcurementProtocolDto,
  ) {
    return this.protocols.award(organizationId, id, {
      winnerBidId: dto.winnerBidId,
      contractType: dto.contractType as never,
    });
  }

  @Post(":id/cancel")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.PROCUREMENT_TENDERS_PRO)
  @ApiOperation({ summary: "Cancel tender protocol" })
  cancel(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.cancel(organizationId, id);
  }
}
