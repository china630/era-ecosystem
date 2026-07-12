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
import { BinBalanceService } from "./bin-balance.service";
import { WmsMobileService } from "./wms-mobile.service";
import {
  ConfirmPickLineDto,
  CreatePickListDto,
  CreateWarehouseZoneDto,
  UpdateWarehouseZoneDto,
  WmsAdjustBinDto,
  WmsIssueFromBinDto,
  WmsPutAwaySuggestQueryDto,
  WmsReceiveToBinDto,
  WmsScanQueryDto,
  WmsTransferBinDto,
} from "./dto/wms.dto";

@ApiTags("inventory-wms")
@ApiBearerAuth("bearer")
@Controller("inventory/wms")
@UseGuards(SubscriptionGuard, RolesGuard)
@RequiresModule("inventory")
export class WmsController {
  constructor(
    private readonly bins: BinBalanceService,
    private readonly wms: WmsMobileService,
  ) {}

  @Get("scan")
  @ApiOperation({ summary: "Scan warehouse bin by barcode or code" })
  scan(
    @OrganizationId() organizationId: string,
    @Query() query: WmsScanQueryDto,
  ) {
    return this.wms.scanByBarcode(
      organizationId,
      query.barcode,
      query.warehouseId,
    );
  }

  @Get("bin-balances/:binId")
  @ApiOperation({ summary: "Bin details with product balances" })
  getBinBalance(
    @OrganizationId() organizationId: string,
    @Param("binId") binId: string,
  ) {
    return this.bins.getBinBalance(organizationId, binId);
  }

  @Get("zones")
  @ApiOperation({ summary: "List warehouse zones" })
  listZones(
    @OrganizationId() organizationId: string,
    @Query("warehouseId") warehouseId: string,
  ) {
    return this.wms.listZones(organizationId, warehouseId);
  }

  @Post("zones")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create warehouse zone" })
  createZone(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWarehouseZoneDto,
  ) {
    return this.wms.createZone(organizationId, dto);
  }

  @Patch("zones/:zoneId")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update warehouse zone" })
  updateZone(
    @OrganizationId() organizationId: string,
    @Param("zoneId") zoneId: string,
    @Body() dto: UpdateWarehouseZoneDto,
  ) {
    return this.wms.updateZone(organizationId, zoneId, dto);
  }

  @Delete("zones/:zoneId")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Delete empty warehouse zone" })
  deleteZone(
    @OrganizationId() organizationId: string,
    @Param("zoneId") zoneId: string,
  ) {
    return this.wms.deleteZone(organizationId, zoneId);
  }

  @Get("put-away/suggest")
  @ApiOperation({ summary: "Suggest STORAGE zone bin for put-away" })
  suggestPutAway(
    @OrganizationId() organizationId: string,
    @Query() query: WmsPutAwaySuggestQueryDto,
  ) {
    return this.wms.suggestPutAway(
      organizationId,
      query.warehouseId,
      query.productId,
    );
  }

  @Post("receive")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: "Receive stock into bin" })
  receive(
    @OrganizationId() organizationId: string,
    @Body() dto: WmsReceiveToBinDto,
  ) {
    return this.bins.receiveToBin(organizationId, dto);
  }

  @Post("issue")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: "Issue stock from bin" })
  issue(
    @OrganizationId() organizationId: string,
    @Body() dto: WmsIssueFromBinDto,
  ) {
    return this.bins.issueFromBin(organizationId, dto);
  }

  @Post("transfer")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: "Transfer stock between bins" })
  transfer(
    @OrganizationId() organizationId: string,
    @Body() dto: WmsTransferBinDto,
  ) {
    return this.bins.transferBin(organizationId, dto);
  }

  @Post("adjust")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Adjust bin quantity (cycle count)" })
  adjust(
    @OrganizationId() organizationId: string,
    @Body() dto: WmsAdjustBinDto,
  ) {
    return this.bins.adjustBin(organizationId, dto);
  }

  @Get("pick-lists")
  @ApiOperation({ summary: "List pick lists" })
  listPickLists(
    @OrganizationId() organizationId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.wms.listPickLists(organizationId, warehouseId);
  }

  @Get("pick-lists/:pickListId")
  @ApiOperation({ summary: "Pick list detail" })
  getPickList(
    @OrganizationId() organizationId: string,
    @Param("pickListId") pickListId: string,
  ) {
    return this.wms.getPickList(organizationId, pickListId);
  }

  @Post("pick-lists")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: "Create pick list (optionally from invoice)" })
  createPickList(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePickListDto,
  ) {
    return this.wms.createPickList(organizationId, dto);
  }

  @Post("pick-lists/:pickListId/confirm-line")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: "Confirm pick line with bin scan" })
  confirmPickLine(
    @OrganizationId() organizationId: string,
    @Param("pickListId") pickListId: string,
    @Body() dto: ConfirmPickLineDto,
  ) {
    return this.wms.confirmPickLine(organizationId, pickListId, dto);
  }

  @Post("pick-lists/:pickListId/cancel")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Cancel pick list" })
  cancelPickList(
    @OrganizationId() organizationId: string,
    @Param("pickListId") pickListId: string,
  ) {
    return this.wms.cancelPickList(organizationId, pickListId);
  }
}
