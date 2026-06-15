import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductKind } from "@era/bank-core-database";
import { IsDateString, IsEnum, IsObject, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { ProductFactoryService } from "./product-factory.service";

class CreateProductTemplateDto {
  @IsString()
  moduleKey!: string;

  @IsEnum(ProductKind)
  kind!: ProductKind;

  @IsString()
  name!: string;

  @IsString()
  currency!: string;

  @IsObject()
  paramsJson!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;
}

@ApiTags("product-templates")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("product-templates")
export class ProductFactoryController {
  constructor(private readonly productFactory: ProductFactoryService) {}

  @Get()
  list() {
    return this.productFactory.list();
  }

  @Post()
  create(@Body() dto: CreateProductTemplateDto) {
    return this.productFactory.create({
      ...dto,
      effectiveFrom: new Date(dto.effectiveFrom),
    });
  }
}
