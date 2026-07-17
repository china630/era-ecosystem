import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EmployeeKind, TaxResidencyStatus } from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";

export class CreateEmployeeDto {
  @ApiProperty({ description: "MDM GlobalNaturalPerson id (resolve via workforce/MDM first)" })
  @IsUUID()
  globalPersonId!: string;

  @ApiPropertyOptional({ enum: EmployeeKind, default: EmployeeKind.EMPLOYEE })
  @IsOptional()
  @IsEnum(EmployeeKind)
  kind?: EmployeeKind;

  @ApiPropertyOptional({ enum: TaxResidencyStatus, default: TaxResidencyStatus.RESIDENT })
  @IsOptional()
  @IsEnum(TaxResidencyStatus)
  taxResidencyStatus?: TaxResidencyStatus;

  @ApiPropertyOptional({ example: "AZ" })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workPermitNumber?: string;

  @ApiPropertyOptional({
    description: "VÖEN (10 цифр), обязателен для CONTRACTOR",
    example: "1234567890",
  })
  @ValidateIf((o: CreateEmployeeDto) => o.kind === EmployeeKind.CONTRACTOR)
  @IsString()
  @Matches(/^\d{10}$/, { message: "voen must be 10 digits" })
  voen?: string;

  @ApiPropertyOptional({ description: "Ata adı (отчество) — payroll document only" })
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiProperty({ description: "Штатная должность (справочник JobPosition)" })
  @IsUUID()
  positionId!: string;

  @ApiPropertyOptional({ description: "CP workforce employment id mirror" })
  @IsOptional()
  @IsUUID()
  cpEmploymentId?: string;

  @ApiPropertyOptional({ description: "Platform user id for self-service HR" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: "2024-01-15",
    description: "Hire date (migration baseline for HR/Absences).",
  })
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional({
    example: 2500,
    description: "Gross total AZN (= tariff + supplement). If omitted when tariff/supplement set, computed as sum.",
  })
  @ValidateIf(
    (o: CreateEmployeeDto) =>
      o.tariffSalary == null && o.supplementSalary == null,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ description: "Base tariff AZN" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tariffSalary?: number;

  @ApiPropertyOptional({ description: "Supplement AZN" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  supplementSalary?: number;

  @ApiPropertyOptional({ description: "Work schedule id" })
  @IsOptional()
  @IsUUID()
  workScheduleId?: string;

  @ApiPropertyOptional({
    description:
      "Фиксированные соц. удержания с выплаты подрядчику в месяц (AZN), только для CONTRACTOR",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contractorMonthlySocialAzn?: number;

  @ApiPropertyOptional({
    description:
      "Initial salary balance (AZN) for average salary calculations (pre-ERP payroll history).",
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialSalaryBalance?: number;

  @ApiPropertyOptional({
    description: "Initial vacation days at migration date.",
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialVacationDays?: number;

  @ApiPropertyOptional({
    description:
      "Average monthly salary for last 12 months (migration helper for vacation calculations).",
    example: 2400,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgMonthlySalaryLastYear?: number;
}

export class ConvertEmployeeToFinDto {
  @ApiProperty({ example: "1A2B3C4" })
  @IsString()
  @IsNotEmpty()
  finCode!: string;
}
