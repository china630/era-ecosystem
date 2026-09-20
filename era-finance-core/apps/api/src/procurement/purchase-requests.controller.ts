import { CP_PERMISSION } from "@era/contracts";
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
import { PurchaseRequestStatus } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { ApprovePurchaseRequestDto } from "./dto/approve-purchase-request.dto";
import { CreatePurchaseRequestDto } from "./dto/create-purchase-request.dto";
import { UpdatePurchaseRequestDto } from "./dto/update-purchase-request.dto";
import { PurchaseRequestsService } from "./purchase-requests.service";

@ApiTags("procurement-requests")
@ApiBearerAuth("bearer")
@Controller("procurement/requests")
@UseGuards(PermissionsGuard)
export class PurchaseRequestsController {
  constructor(private readonly requests: PurchaseRequestsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
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
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Create purchase request (DRAFT)" })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.requests.create(organizationId, user.userId, dto);
  }

  @Get(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Get purchase request" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.get(organizationId, id);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Update purchase request" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.requests.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Delete DRAFT purchase request" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.remove(organizationId, id);
  }

  @Post(":id/submit")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Submit purchase request (DRAFT → SUBMITTED)" })
  submit(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.requests.submit(organizationId, id);
  }

  @Post(":id/approve")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Approve or reject purchase request" })
  approve(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApprovePurchaseRequestDto,
  ) {
    return this.requests.approve(organizationId, id, user.userId, dto);
  }
}
