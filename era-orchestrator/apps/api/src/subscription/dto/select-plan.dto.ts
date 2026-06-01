import { TariffTier } from "@era365/database";
import { IsEnum } from "class-validator";

export class SelectPlanDto {
  @IsEnum(TariffTier)
  tier!: TariffTier;
}

