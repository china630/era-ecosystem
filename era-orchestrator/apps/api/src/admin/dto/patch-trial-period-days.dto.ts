import { IsInt, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class PatchTrialPeriodDaysDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  days!: number;
}
