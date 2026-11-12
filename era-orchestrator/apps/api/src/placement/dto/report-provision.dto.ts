import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class ReportProvisionDto {
  @IsBoolean()
  ok!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  applyLog?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  /** Optional agent-side health summary line. */
  @IsOptional()
  @IsString()
  healthSummary?: string;
}
