import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { WorkforceTimesheetEntryType } from "@era365/database";

export class ListWorkforceTimesheetQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({ example: 1, description: "1-based employment page" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 25,
    description: "Employments per page (max 100) for ~240 headcount grids",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: "Filter ACTIVE roster by org unit" })
  @IsOptional()
  @IsUUID()
  orgUnitId?: string;

  @ApiPropertyOptional({ description: "Filter ACTIVE roster by employment" })
  @IsOptional()
  @IsUUID()
  employmentId?: string;
}

export class WorkforceTimesheetBatchItemDto {
  @ApiProperty()
  @IsUUID()
  employmentId!: string;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  fromDay!: number;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  toDay!: number;

  @ApiProperty({ enum: WorkforceTimesheetEntryType })
  @IsEnum(WorkforceTimesheetEntryType)
  type!: WorkforceTimesheetEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  hours?: number;
}

export class WorkforceTimesheetBatchUpdateDto {
  @ApiProperty({ type: [WorkforceTimesheetBatchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkforceTimesheetBatchItemDto)
  batches!: WorkforceTimesheetBatchItemDto[];
}

export class ApproveTimesheetEntriesDto {
  @IsArray()
  @IsUUID("4", { each: true })
  entryIds!: string[];
}
