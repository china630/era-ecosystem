import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
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
import { PurchaseRequestStatus, UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { ApprovePurchaseRequestDto } from "./dto/approve-purchase-request.dto";
import { CreatePurchaseRequestDto } from "./dto/create-purchase-request.dto";
import { LinkPurchaseDto } from "./dto/link-purchase.dto";
import { UpdatePurchaseRequestDto } from "./dto/update-purchase-request.dto";
import { PurchaseRequestsService } from "./purchase-requests.service";

@ApiTags("procurement-requests")
@ApiBearerAuth("bearer")
@Controller("procurement/requests")
@UseGuards(RolesGuard, PermissionsGuard)
export class PurchaseRequestsController {
  constructor(private readonly requests: PurchaseRequestsService) {}

  @Get()
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "List purchase requests" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query("status", new ParseEnumPipe(PurchaseRequestStatus, { optional: true }))
    status?: PurchaseRequestStatus,
  ) {
    return this.requests.list(organizationId, { page, pageSize, status });
  }

  @Post()
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Create purchase request (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.requests.create(organizationId, user.userId, dto);
  }

  @Get(":id")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Get purchase request" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.get(organizationId, id);
  }

  @Patch(":id")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Update purchase request" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.requests.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Delete DRAFT purchase request" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.remove(organizationId, id);
  }

  @Post(":id/submit")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Submit purchase request (DRAFT → SUBMITTED)" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.submit(organizationId, id);
  }

  @Post(":id/approve")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: "Approve or reject purchase request" })
  approve(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApprovePurchaseRequestDto,
  ) {
    return this.requests.approve(organizationId, id, user.userId, dto);
  }

  @Post(":id/link-purchase")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({
    summary:
      "Link posted purchase invoice transaction (ORDERED); auto-close when final + warehouse receipt",
  })
  linkPurchase(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LinkPurchaseDto,
  ) {
    return this.requests.linkPurchase(organizationId, id, dto.transactionId);
  }
}
