import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PayrollComponentKind } from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  PAYROLL_COMPONENT_CODES,
  PayrollComponentCode,
} from "../payroll-component-codes";

export class PayrollEmployeeLineDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: PAYROLL_COMPONENT_CODES })
  @IsIn(PAYROLL_COMPONENT_CODES)
  code!: PayrollComponentCode;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePayrollRunDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({
    description:
      "Утверждённый табель за этот месяц — импорт дней WORK/VACATION/SICK/ezamiyyət в листовки",
  })
  @IsOptional()
  @IsUUID()
  timesheetId?: string;

  @ApiPropertyOptional({
    type: [PayrollEmployeeLineDto],
    description: "Manual bonus / deduction / earning lines per employee",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollEmployeeLineDto)
  employeeLines?: PayrollEmployeeLineDto[];
}

export class EmailPayslipDto {
  @ApiPropertyOptional({ description: "Override recipient email" })
  @IsOptional()
  @IsString()
  to?: string;
}

export class CreatePayrollComponentDto {
  @ApiProperty({ enum: PAYROLL_COMPONENT_CODES })
  @IsIn(PAYROLL_COMPONENT_CODES)
  code!: PayrollComponentCode;

  @ApiProperty({ enum: PayrollComponentKind })
  @IsEnum(PayrollComponentKind)
  kind!: PayrollComponentKind;

  @ApiProperty()
  @IsString()
  nameAz!: string;

  @ApiProperty()
  @IsString()
  nameRu!: string;

  @ApiProperty()
  @IsString()
  nameEn!: string;
}
