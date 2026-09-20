import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class ReprovisionEmploymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  login?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pin?: string;

  /**
   * When set (including `[]`), replace effective satellite access with this set.
   * Omitted = leave bindings unchanged (classic reprovision).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  satelliteKeys?: string[];
}
