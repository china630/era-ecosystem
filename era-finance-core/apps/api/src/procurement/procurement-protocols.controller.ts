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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import {
  CreateProcurementProtocolDto,
  UpdateProcurementProtocolDto,
} from "./dto/procurement-protocol.dto";
import { ProcurementProtocolsService } from "./procurement-protocols.service";

@ApiTags("procurement-protocols")
@ApiBearerAuth("bearer")
@Controller("procurement/protocols")
@UseGuards(RolesGuard, PermissionsGuard)
export class ProcurementProtocolsController {
  constructor(private readonly protocols: ProcurementProtocolsService) {}

  @Get()
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "List procurement protocols" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.protocols.list(organizationId, { page, pageSize });
  }

  @Post()
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Create procurement protocol (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateProcurementProtocolDto,
  ) {
    return this.protocols.create(organizationId, dto);
  }

  @Get(":id")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "Get procurement protocol" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.get(organizationId, id);
  }

  @Patch(":id")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Update procurement protocol" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementProtocolDto,
  ) {
    return this.protocols.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Delete DRAFT procurement protocol" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.remove(organizationId, id);
  }

  @Post(":id/register")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Register protocol (DRAFT → REGISTERED)" })
  register(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.protocols.register(organizationId, id);
  }
}
