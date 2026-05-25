import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateBudgetLineDto {
  @ApiProperty({ example: "221" })
  @IsString()
  @MinLength(1)
  accountCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limitAnnual!: number;

  @ApiPropertyOptional({
    description: 'Monthly caps keyed by "01".."12"',
    example: { "01": 1000, "02": 1000 },
  })
  @IsOptional()
  @IsObject()
  limitMonthly?: Record<string, number>;
}

export class CreateBudgetYearDto {
  @ApiProperty({ example: 2027 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ type: [CreateBudgetLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines?: CreateBudgetLineDto[];
}
