import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Service advance actions.
 * Wave 1 order: markProvisioned → configure → freeze → exportSlice →
 * importSlice → cutoverEndpoint → smoke → complete (plus rollback / fail).
 */
export enum PlacementAdvanceAction {
  markProvisioned = "markProvisioned",
  configure = "configure",
  freeze = "freeze",
  exportSlice = "exportSlice",
  importSlice = "importSlice",
  /** Legacy Sync bind; not on the Start wizard path. */
  bindAndConfig = "bindAndConfig",
  cutoverEndpoint = "cutoverEndpoint",
  smoke = "smoke",
  complete = "complete",
  rollback = "rollback",
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
