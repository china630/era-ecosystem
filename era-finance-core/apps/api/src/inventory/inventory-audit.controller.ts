import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgPolicySubject } from "../auth/policies/policy-subject";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateInventoryAuditDto } from "./dto/create-inventory-audit.dto";
import { InventoryAuditService } from "./inventory-audit.service";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";

@ApiTags("inventory-audits")
@ApiBearerAuth("bearer")
@Controller("inventory/audits")
@UseGuards(SubscriptionGuard)
@RequiresModule("inventory")
export class InventoryAuditController {
  constructor(private readonly audits: InventoryAuditService) {}

  @Get()
  @ApiOperation({ summary: "Список инвентаризационных описей" })
  findAll(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.audits.findAll(organizationId, { page, pageSize });
  }

  @Patch("lines/:lineId")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVENTORY_APPROVE)
  @ApiOperation({
    summary:
      "Обновить строку описи (DRAFT): factQty и costPrice (запрещено в APPROVED/закрытом периоде)",
  })
  patchLine(
    @OrganizationId() organizationId: string,
    @Param("lineId") lineId: string,
    @Body()
    dto: {
      factQty?: number;
      costPrice?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.patchLine(
      organizationId,
      lineId,
      dto,
      requireOrgRole(user),
    );
  }

  @Post(":id/approve")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVENTORY_APPROVE)
  @ApiOperation({
    summary:
      "Провести черновик опись: adjustStock + journal в одной prisma.$transaction (TZ §10.1)",
  })
  approveDraft(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.approveDraft(
      organizationId,
      id,
      user.userId,
      requireOrgRole(user),
    );
  }

  @Post(":id/sync-system")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVENTORY_APPROVE)
  @ApiOperation({
    summary:
      "Черновик описи: обновить systemQty по фактическим остаткам StockItem на складе документа",
  })
  syncSystem(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.syncSystemFromStock(
      organizationId,
      id,
      requireOrgRole(user),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Опись по id" })
  findOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.audits.findOne(organizationId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVENTORY_APPROVE)
  @ApiOperation({
    summary:
      "Инвентаризационная опись: DRAFT — только запись; APPROVED — корректировки в одной транзакции (adjustStockInTransaction(tx)) по расхождениям",
  })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInventoryAuditDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.create(organizationId, dto, requireOrgPolicySubject(user));
  }
}
