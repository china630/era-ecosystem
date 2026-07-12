import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth("bearer")
@Controller("products")
@UseGuards(RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get("units-of-measure")
  @ApiOperation({
    summary: "Системный каталог единиц измерения",
    description: "Предпочтительно: GET /api/system/units-of-measure",
  })
  listUnitsOfMeasure() {
    return this.products.listUnitsOfMeasure();
  }

  @Get()
  @ApiOperation({ summary: "Список товаров (опционально search + limit для автодополнения)" })
  list(
    @OrganizationId() orgId: string,
    @Query("isService") isService?: string,
    @Query("search") search?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    return this.products.list(orgId, { isService, search, limit });
  }

  @Get(":id")
  @ApiOperation({ summary: "Товар по id" })
  getOne(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.products.getOne(orgId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать товар или услугу" })
  create(@OrganizationId() orgId: string, @Body() dto: CreateProductDto) {
    return this.products.create(orgId, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Обновить товар" })
  update(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(orgId, id, dto);
  }
}
