import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Body,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";

import { OrganizationId } from "../common/org-id.decorator";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth("bearer")
@Controller("products")
@UseGuards(PermissionsGuard)
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

  @Get("import-template.xlsx")
  @ApiOperation({ summary: "Blank Excel template for products and services" })
  async importTemplate(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("products");
    sheet.addRow(["sku", "name", "price", "vatRate", "isService", "revenueAccountCode"]);
    sheet.addRow(["TEA-01", "Tea", 4, 18, "false", "601"]);
    sheet.addRow(["LAB-CBC", "Complete blood count", 25, 0, "true", "601"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader("Content-Disposition", 'attachment; filename="products-import.xlsx"');
    return new StreamableFile(buf);
  }

  @Post("import-xlsx")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Import products and services from Excel. Satellites do not push rows." })
  async importXlsx(
    @OrganizationId() orgId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("file is required");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException("workbook has no sheet");
    const header = (sheet.getRow(1).values as Array<unknown>).map((cell) =>
      String(cell ?? "").trim(),
    );
    const col = (name: string) => header.indexOf(name);
    const skuCol = col("sku");
    const nameCol = col("name");
    const priceCol = col("price");
    if (skuCol < 1 || nameCol < 1 || priceCol < 1) {
      throw new BadRequestException("header must include sku, name, price");
    }
    const created: string[] = [];
    const errors: string[] = [];
    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const sku = String(row.getCell(skuCol).text ?? "").trim();
      const name = String(row.getCell(nameCol).text ?? "").trim();
      if (!sku && !name) continue;
      const price = Number(row.getCell(priceCol).text || row.getCell(priceCol).value);
      const vatRaw = col("vatRate") > 0 ? Number(row.getCell(col("vatRate")).text) : 0;
      const serviceRaw =
        col("isService") > 0 ? String(row.getCell(col("isService")).text).trim().toLowerCase() : "";
      const isService = serviceRaw === "true" || serviceRaw === "1" || serviceRaw === "yes" || serviceRaw === "service";
      const revenue =
        col("revenueAccountCode") > 0
          ? String(row.getCell(col("revenueAccountCode")).text ?? "").trim()
          : "";
      try {
        await this.products.create(orgId, {
          sku,
          name,
          price,
          vatRate: Number.isFinite(vatRaw) ? vatRaw : 0,
          isService,
          ...(revenue ? { revenueAccountCode: revenue } : {}),
        });
        created.push(sku);
      } catch (err) {
        errors.push(`${sku || r}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    return { created: created.length, skus: created, errors };
  }

  @Get(":id")
  @ApiOperation({ summary: "Товар по id" })
  getOne(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.products.getOne(orgId, id);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Создать товар или услугу" })
  create(@OrganizationId() orgId: string, @Body() dto: CreateProductDto) {
    return this.products.create(orgId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Обновить товар" })
  update(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(orgId, id, dto);
  }
}
