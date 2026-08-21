import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export enum DeploymentTopologyDto {
  SHARED = "SHARED",
  DEDICATED = "DEDICATED",
  ONPREM = "ONPREM",
}

export class CreatePlacementJobDto {
  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @IsEnum(DeploymentTopologyDto)
  fromTopology!: DeploymentTopologyDto;

  @IsEnum(DeploymentTopologyDto)
  toTopology!: DeploymentTopologyDto;

  /** Optional cutover target URL (applied on cutover action). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  targetBaseUrl?: string;
}
