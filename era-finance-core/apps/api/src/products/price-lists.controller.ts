import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import {
  CreateDiscountRuleDto,
  CreatePriceListDto,
  UpdateDiscountRuleDto,
  UpdatePriceListDto,
} from "./dto/price-list.dto";
import { PriceListsService } from "./price-lists.service";

@ApiTags("price-lists")
@ApiBearerAuth("bearer")
@Controller("price-lists")
@UseGuards(PermissionsGuard)
export class PriceListsController {
  constructor(private readonly priceLists: PriceListsService) {}

  @Get()
  @ApiOperation({ summary: "List price lists" })
  list(
    @OrganizationId() orgId: string,
    @Query("isActive") isActive?: string,
  ) {
    const active =
      isActive === "true" ? true : isActive === "false" ? false : undefined;
    return this.priceLists.list(orgId, { isActive: active });
  }

  @Get("resolve")
  @ApiOperation({ summary: "Resolve unit price for product (list + discounts)" })
  resolve(
    @OrganizationId() orgId: string,
    @Query("productId") productId: string,
    @Query("counterpartyId") counterpartyId?: string,
    @Query("channel") channel?: string,
    @Query("qty") qtyStr?: string,
    @Query("asOfDate") asOfDate?: string,
  ) {
    const qty = qtyStr ? Number(qtyStr) : undefined;
    return this.priceLists.resolvePrice(orgId, {
      productId,
      counterpartyId: counterpartyId?.trim() || undefined,
      channel: channel?.trim() || undefined,
      qty: Number.isFinite(qty) ? qty : undefined,
      asOfDate: asOfDate?.trim() || undefined,
    });
  }

  @Get("discount-rules")
  @ApiOperation({ summary: "List discount rules" })
  listDiscountRules(
    @OrganizationId() orgId: string,
    @Query("priceListId") priceListId?: string,
  ) {
    return this.priceLists.listDiscountRules(orgId, priceListId?.trim() || undefined);
  }

  @Post("discount-rules")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Create discount rule" })
  createDiscountRule(
    @OrganizationId() orgId: string,
    @Body() dto: CreateDiscountRuleDto,
  ) {
    return this.priceLists.createDiscountRule(orgId, dto);
  }

  @Patch("discount-rules/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Update discount rule" })
  updateDiscountRule(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDiscountRuleDto,
  ) {
    return this.priceLists.updateDiscountRule(orgId, id, dto);
  }

  @Delete("discount-rules/:id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Deactivate discount rule" })
  removeDiscountRule(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.priceLists.removeDiscountRule(orgId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Price list detail with lines" })
  getOne(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.priceLists.getOne(orgId, id);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Create price list" })
  create(@OrganizationId() orgId: string, @Body() dto: CreatePriceListDto) {
    return this.priceLists.create(orgId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Update price list" })
  update(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePriceListDto,
  ) {
    return this.priceLists.update(orgId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Deactivate price list" })
  remove(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.priceLists.remove(orgId, id);
  }
}
