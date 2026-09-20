import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  WorkforcePersonnelOrderStatus,
  WorkforcePersonnelOrderType,
} from "@era365/database";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
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

  @ApiPropertyOptional({ enum: ["az", "ru"] })
  @IsOptional()
  @IsIn(["az", "ru"])
  locale?: string;

  @ApiPropertyOptional({ description: "LEAVE_ANNUAL start (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  leaveStartDate?: string;

  @ApiPropertyOptional({ description: "LEAVE_ANNUAL end (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  leaveEndDate?: string;

  @ApiPropertyOptional({ description: "Issue immediately after create" })
  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

export class ListPersonnelOrdersQueryDto {
  @ApiPropertyOptional({ enum: WorkforcePersonnelOrderType })
  @IsOptional()
  @IsEnum(WorkforcePersonnelOrderType)
  type?: WorkforcePersonnelOrderType;

  @ApiPropertyOptional({ enum: WorkforcePersonnelOrderStatus })
  @IsOptional()
  @IsEnum(WorkforcePersonnelOrderStatus)
  status?: WorkforcePersonnelOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employmentId?: string;
}

export class PreviewPersonnelOrderTemplateDto {
  @ApiProperty({ enum: WorkforcePersonnelOrderType })
  @IsEnum(WorkforcePersonnelOrderType)
  type!: WorkforcePersonnelOrderType;

  @ApiProperty({ enum: ["az", "ru"] })
  @IsIn(["az", "ru"])
  locale!: string;

  @ApiProperty({ description: "HTML with {{path}} placeholders" })
  @IsString()
  @MinLength(1)
  bodyHtml!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class UpsertPersonnelOrderTemplateDto {
  @ApiProperty({ enum: WorkforcePersonnelOrderType })
  @IsEnum(WorkforcePersonnelOrderType)
  type!: WorkforcePersonnelOrderType;

  @ApiProperty({ enum: ["az", "ru"] })
  @IsIn(["az", "ru"])
  locale!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: "HTML with {{path}} placeholders" })
  @IsString()
  @MinLength(1)
  bodyHtml!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  placeholders?: string[];

  @ApiPropertyOptional({
    enum: ["org", "holding"],
    description: "org override (default) or holding default",
  })
  @IsOptional()
  @IsIn(["org", "holding"])
  scope?: "org" | "holding";
}

export class CreateStaffScheduleRevisionDto {
  @ApiProperty({ example: "Ştat cədvəli 2026-Q3" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: "Submit immediately" })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
