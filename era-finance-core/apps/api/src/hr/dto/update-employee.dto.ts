import { ApiPropertyOptional } from "@nestjs/swagger";
import { EmployeeKind, TaxResidencyStatus } from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ enum: EmployeeKind })
  @IsOptional()
  @IsEnum(EmployeeKind)
  kind?: EmployeeKind;

  @ApiPropertyOptional({ description: "Для CONTRACTOR — 10 цифр" })
  @ValidateIf((o: UpdateEmployeeDto) => o.kind === EmployeeKind.CONTRACTOR)
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: "voen must be 10 digits" })
  voen?: string;

  @ApiPropertyOptional({ enum: TaxResidencyStatus })
  @IsOptional()
  @IsEnum(TaxResidencyStatus)
  taxResidencyStatus?: TaxResidencyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workPermitNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffPin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiPropertyOptional({ description: "Штатная должность" })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Hire date (migration baseline for HR/Absences).",
  })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contractorMonthlySocialAzn?: number | null;

  @ApiPropertyOptional({
    description:
      "Initial salary balance (AZN) for average salary calculations (pre-ERP payroll history).",
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialSalaryBalance?: number | null;

  @ApiPropertyOptional({ description: "Date of birth (HR birthday reminders)" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: "Employment contract end date (T-7 reminder)" })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({
    description: "Initial vacation days at migration date.",
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialVacationDays?: number | null;

  @ApiPropertyOptional({
    description:
      "Average monthly salary for last 12 months (migration helper for vacation calculations).",
    example: 2400,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgMonthlySalaryLastYear?: number | null;

  @ApiPropertyOptional({ description: "244 accountable advance GL subcode" })
  @IsOptional()
  @IsString()
  accountableAccountCode244?: string | null;
}
