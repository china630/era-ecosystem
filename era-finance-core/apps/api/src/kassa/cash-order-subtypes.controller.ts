import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CashOrderSubtypeDirection, UserRole } from "@erafinance/database";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { CashOrderSubtypesService } from "./cash-order-subtypes.service";

class CreateCashOrderSubtypeDto {
  @IsEnum(CashOrderSubtypeDirection)
  direction!: CashOrderSubtypeDirection;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  nameAz!: string;

  @IsString()
  @MinLength(1)
  nameRu!: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@ApiTags("cash-order-subtypes")
@ApiBearerAuth("bearer")
@Controller("banking/cash/subtypes")
export class CashOrderSubtypesController {
  constructor(private readonly subtypes: CashOrderSubtypesService) {}

  @Get()
  @ApiOperation({ summary: "List PKO/RKO cash-order subtypes (ensures seed)" })
  list(
    @OrganizationId() organizationId: string,
    @Query("direction") directionRaw?: string,
    @Query("activeOnly") activeOnlyRaw?: string,
  ) {
    const direction =
      directionRaw === "PKO" || directionRaw === "RKO"
        ? CashOrderSubtypeDirection[directionRaw]
        : undefined;
    const activeOnly = activeOnlyRaw !== "0";
    return this.subtypes.list(organizationId, direction, activeOnly);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create custom cash-order subtype" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateCashOrderSubtypeDto,
  ) {
    return this.subtypes.create(organizationId, dto);
  }
}
