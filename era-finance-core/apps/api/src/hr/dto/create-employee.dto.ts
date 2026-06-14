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
import { AZ_FIN_CODE_PATTERN } from "../../utils/validators/fin.validator";

export class CreateEmployeeDto {
  @ApiPropertyOptional({ enum: EmployeeKind, default: EmployeeKind.EMPLOYEE })
  @IsOptional()
  @IsEnum(EmployeeKind)
  kind?: EmployeeKind;

  @ApiPropertyOptional({
    example: "1A2B3C4",
    description: "Required for AZ residents; optional for foreign employees",
  })
  @ValidateIf(
    (o: CreateEmployeeDto) =>
      (o.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT) === TaxResidencyStatus.RESIDENT,
  )
  @IsString()
  @Matches(AZ_FIN_CODE_PATTERN, {
    message: "finCode must be 7 chars (A–Z/0–9, excluding I and O)",
  })
  finCode?: string;

  @ApiPropertyOptional({ enum: TaxResidencyStatus, default: TaxResidencyStatus.RESIDENT })
  @IsOptional()
  @IsEnum(TaxResidencyStatus)
  taxResidencyStatus?: TaxResidencyStatus;

  @ApiPropertyOptional({ example: "AZ" })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ description: "Required for non-resident employees without FIN" })
  @ValidateIf(
    (o: CreateEmployeeDto) =>
      (o.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT) === TaxResidencyStatus.NON_RESIDENT &&
      !o.finCode?.trim(),
  )
  @IsString()
  @IsNotEmpty()
  passportNumber?: string;

  @ApiPropertyOptional({ description: "Passport issuing country (ISO-2)" })
  @ValidateIf(
    (o: CreateEmployeeDto) =>
      (o.taxResidencyStatus ?? TaxResidencyStatus.RESIDENT) === TaxResidencyStatus.NON_RESIDENT &&
      !o.finCode?.trim(),
  )
  @IsString()
  @IsNotEmpty()
  issuingCountry?: string;

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: "Ata adı (отчество)" })
  @IsString()
  @IsNotEmpty()
  patronymic!: string;

  @ApiProperty({ description: "Штатная должность (справочник JobPosition)" })
  @IsUUID()
  positionId!: string;

  @ApiPropertyOptional({ description: "Platform user id for self-service HR" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: "Satellite key to provision operational access (e.g. industry_fnb_pos)",
  })
  @IsOptional()
  @IsString()
  provisionedSatelliteKey?: string;

  @ApiPropertyOptional({ description: "Override satellite role code" })
  @IsOptional()
  @IsString()
  provisionedSatelliteRole?: string;

  @ApiPropertyOptional({ description: "PIN for satellite staff login" })
  @IsOptional()
  @IsString()
  staffPin?: string;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: "2024-01-15",
    description: "Hire date (migration baseline for HR/Absences).",
  })
  @IsDateString()
  hireDate!: string;

  @ApiProperty({ example: 2500, description: "Gross, AZN" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary!: number;

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
  @Matches(AZ_FIN_CODE_PATTERN, {
    message: "finCode must be 7 chars (A–Z/0–9, excluding I and O)",
  })
  finCode!: string;
}
