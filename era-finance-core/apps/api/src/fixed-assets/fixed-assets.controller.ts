import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { OrganizationId } from "../common/org-id.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { RunMonthlyDepreciationDto } from "./dto/run-monthly-depreciation.dto";
import { RecordFixedAssetUsageDto } from "./dto/record-fixed-asset-usage.dto";
import { UpsertFixedAssetMonthlyUsageDto } from "./dto/upsert-monthly-usage.dto";
import { BulkFixedAssetMonthlyUsageDto } from "./dto/bulk-monthly-usage.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { AcquireFixedAssetDto } from "./dto/acquire-fixed-asset.dto";
import { CapitalizeFixedAssetDto } from "./dto/capitalize-fixed-asset.dto";
import { CommissionFixedAssetDto } from "./dto/commission-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";
import {
  GratuitousInFixedAssetDto,
  GratuitousOutFixedAssetDto,
} from "./dto/gratuitous-fixed-asset.dto";
import { InventoryFixedAssetDto } from "./dto/inventory-fixed-asset.dto";
import { RevalueFixedAssetDto } from "./dto/revalue-fixed-asset.dto";
import { TransferFixedAssetDto } from "./dto/transfer-fixed-asset.dto";
import { FixedAssetLifecycleService } from "./fixed-asset-lifecycle.service";
import { FixedAssetsService } from "./fixed-assets.service";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@ApiTags("fixed-assets")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.FIXED_ASSETS)
@Controller("fixed-assets")
export class FixedAssetsController {
  constructor(
    private readonly assets: FixedAssetsService,
    private readonly lifecycle: FixedAssetLifecycleService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Список основных средств" })
  list(@OrganizationId() organizationId: string) {
    return this.assets.list(organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Создать ОС" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.assets.create(organizationId, dto);
  }

  @Get("usage/monthly")
  @ApiOperation({ summary: "List UoP assets and logged monthly usage for a period" })
  listMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.assets.listMonthlyUsage(
      organizationId,
      Number(year),
      Number(month),
    );
  }

  @Post("usage/monthly/bulk")
  @ApiOperation({ summary: "Bulk upsert monthly production units (UoP) before depreciation close" })
  bulkMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkFixedAssetMonthlyUsageDto,
  ) {
    return this.assets.bulkUpsertMonthlyUsage(organizationId, dto);
  }

  @Put(":id/monthly-usage")
  @ApiOperation({ summary: "Upsert monthly production units for one UoP asset" })
  upsertMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertFixedAssetMonthlyUsageDto,
  ) {
    return this.assets.upsertMonthlyUsage(organizationId, id, dto);
  }

  @Post("depreciation/run")
  @ApiOperation({
    summary:
      "Run monthly depreciation (SL/RB batch + UoP from monthly usage; Dr 713 / Cr 112)",
  })
  runMonthlyDepreciation(
    @OrganizationId() organizationId: string,
    @Body() dto: RunMonthlyDepreciationDto,
  ) {
    return this.assets.runMonthlyDepreciation(organizationId, {
      year: dto.year,
      month: dto.month,
    });
  }

  @Post(":id/record-usage")
  @ApiOperation({
    summary:
      "Внести выработку и начислить амортизацию (только UNITS_OF_PRODUCTION)",
  })
  recordUsage(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordFixedAssetUsageDto,
  ) {
    return this.assets.recordUsage(organizationId, id, dto.periodUnits);
  }

  @Post(":id/acquire")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Capitalize fixed asset (Dt 111 / Cr supplier or bank)" })
  acquire(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcquireFixedAssetDto,
  ) {
    return this.lifecycle.acquire(organizationId, id, dto);
  }

  @Post(":id/commission")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Commission fixed asset into service" })
  commission(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CommissionFixedAssetDto,
  ) {
    return this.lifecycle.commission(organizationId, id, dto);
  }

  @Post(":id/capitalize")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Capitalize additional costs onto fixed asset" })
  capitalize(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CapitalizeFixedAssetDto,
  ) {
    return this.lifecycle.capitalize(organizationId, id, dto);
  }

  @Post(":id/revalue")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Revalue fixed asset up or down" })
  revalue(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RevalueFixedAssetDto,
  ) {
    return this.lifecycle.revalue(organizationId, id, dto);
  }

  @Post(":id/dispose")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Dispose fixed asset" })
  dispose(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    return this.lifecycle.dispose(organizationId, id, dto);
  }

  @Post(":id/transfer")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Transfer fixed asset between departments" })
  transfer(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransferFixedAssetDto,
  ) {
    return this.lifecycle.transfer(organizationId, id, dto);
  }

  @Post(":id/gratuitous-in")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Record gratuitous receipt of fixed asset" })
  gratuitousIn(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GratuitousInFixedAssetDto,
  ) {
    return this.lifecycle.gratuitousIn(organizationId, id, dto);
  }

  @Post(":id/gratuitous-out")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Record gratuitous disposal of fixed asset" })
  gratuitousOut(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GratuitousOutFixedAssetDto,
  ) {
    return this.lifecycle.gratuitousOut(organizationId, id, dto);
  }

  @Post(":id/inventory")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Inventory surplus/shortage adjustment for fixed asset" })
  inventory(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InventoryFixedAssetDto,
  ) {
    return this.lifecycle.inventory(organizationId, id, dto);
  }

  @Get(":id/events")
  @ApiOperation({ summary: "List lifecycle events for a fixed asset" })
  listEvents(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.listEvents(organizationId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "ОС по id" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.getOne(organizationId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить ОС" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.assets.update(organizationId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить ОС" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.remove(organizationId, id);
  }
}
