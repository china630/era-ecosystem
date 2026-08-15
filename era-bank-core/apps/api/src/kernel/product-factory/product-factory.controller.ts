import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductKind, ProductStatus } from "@era/bank-core-database";
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { ProductFactoryService } from "./product-factory.service";
import { moduleKeyForKind, paramHintsForKind } from "./product-params";

class CreateProductTemplateDto {
  @IsOptional()
  @IsString()
  moduleKey?: string;

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

class UpdateProductTemplateDto {
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsOptional()
  @IsEnum(ProductKind)
  kind?: ProductKind;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  paramsJson?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

@ApiTags("product-templates")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("product-templates")
export class ProductFactoryController {
  constructor(private readonly productFactory: ProductFactoryService) {}

  @Get()
  list(
    @Query("kind") kind?: ProductKind,
    @Query("status") status?: ProductStatus,
  ) {
    return this.productFactory.list({
      kind: kind && Object.values(ProductKind).includes(kind) ? kind : undefined,
      status:
        status && Object.values(ProductStatus).includes(status)
          ? status
          : undefined,
    });
  }

  @Get("hints/:kind")
  hints(@Param("kind") kind: ProductKind) {
    if (!Object.values(ProductKind).includes(kind)) {
      return { kind, hints: [] };
    }
    return { kind, hints: paramHintsForKind(kind) };
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.productFactory.getById(id);
  }

  @Post()
  create(@Body() dto: CreateProductTemplateDto) {
    return this.productFactory.create({
      kind: dto.kind,
      name: dto.name,
      currency: dto.currency,
      paramsJson: dto.paramsJson,
      effectiveFrom: new Date(dto.effectiveFrom),
      moduleKey: dto.moduleKey ?? moduleKeyForKind(dto.kind),
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductTemplateDto) {
    return this.productFactory.update(id, {
      moduleKey: dto.moduleKey,
      kind: dto.kind,
      name: dto.name,
      currency: dto.currency,
      paramsJson: dto.paramsJson,
      effectiveFrom: dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : undefined,
    });
  }

  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.productFactory.activate(id);
  }

  @Post(":id/retire")
  retire(@Param("id") id: string) {
    return this.productFactory.retire(id);
  }
}
