import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class MarkRegistryPaidDto {
  @ApiPropertyOptional({
    description:
      "BUDGET org: use BudgetLine.accountCode as payroll expense debit instead of preset 711",
  })
  @IsOptional()
  @IsUUID()
  budgetLineId?: string;
}
