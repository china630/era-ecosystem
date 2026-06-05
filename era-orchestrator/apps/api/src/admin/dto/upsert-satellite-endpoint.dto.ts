import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertSatelliteEndpointDto {
  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @IsString()
  @MinLength(1)
  baseUrl!: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
