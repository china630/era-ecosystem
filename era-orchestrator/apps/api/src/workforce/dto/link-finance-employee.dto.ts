import { IsUUID } from "class-validator";

export class LinkFinanceEmployeeDto {
  @IsUUID()
  financeEmployeeId!: string;
}
