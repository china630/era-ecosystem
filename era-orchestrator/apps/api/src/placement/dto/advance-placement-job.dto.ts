import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export enum PlacementAdvanceAction {
  freeze = "freeze",
  exportSlice = "exportSlice",
  markProvisioned = "markProvisioned",
  bindAndConfig = "bindAndConfig",
  cutoverEndpoint = "cutoverEndpoint",
  smoke = "smoke",
  complete = "complete",
  fail = "fail",
}

export class AdvancePlacementJobDto {
  @IsEnum(PlacementAdvanceAction)
  action!: PlacementAdvanceAction;

  /** Override cutover URL for cutoverEndpoint. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  targetBaseUrl?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
