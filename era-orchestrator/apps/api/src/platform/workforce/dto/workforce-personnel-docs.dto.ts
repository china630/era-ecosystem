import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkforcePersonnelOrderType } from "@era365/database";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreatePersonnelOrderDto {
  @ApiProperty()
  @IsUUID()
  employmentId!: string;

  @ApiProperty({ enum: WorkforcePersonnelOrderType })
  @IsEnum(WorkforcePersonnelOrderType)
  type!: WorkforcePersonnelOrderType;

  @ApiProperty({ example: "2026-07-01" })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: "Issue immediately after create" })
  @IsOptional()
  issue?: boolean;
}

export class ListPersonnelOrdersQueryDto {
  @ApiPropertyOptional({ enum: WorkforcePersonnelOrderType })
  @IsOptional()
  @IsEnum(WorkforcePersonnelOrderType)
  type?: WorkforcePersonnelOrderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employmentId?: string;
}

export class CreateStaffScheduleRevisionDto {
  @ApiProperty({ example: "Ştat cədvəli 2026-Q3" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: "Submit immediately" })
  @IsOptional()
  submit?: boolean;
}
