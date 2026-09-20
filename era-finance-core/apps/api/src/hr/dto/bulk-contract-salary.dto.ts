import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

class BulkContractSalaryItemDto {
  @IsUUID()
  employeeId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  salary!: number;

  /** Wave 5: optional management internal rate (AZN). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  internalRate?: number | null;
}

/** Wave 1: set contract salary on many Finance Employees after CP hire-mirror (salary 0). */
export class BulkContractSalaryDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkContractSalaryItemDto)
  items!: BulkContractSalaryItemDto[];
}
