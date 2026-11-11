import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  MinLength,
} from "class-validator";
import { DeploymentTopologyDto } from "./create-placement-job.dto";

export enum PlacementPackagingDto {
  PER_SATELLITE = "PER_SATELLITE",
  SINGLE_STACK = "SINGLE_STACK",
}

export class CreatePlacementBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  satelliteKeys!: string[];

  @IsEnum(DeploymentTopologyDto)
  fromTopology!: DeploymentTopologyDto;

  @IsEnum(DeploymentTopologyDto)
  toTopology!: DeploymentTopologyDto;

  @IsEnum(PlacementPackagingDto)
  packaging!: PlacementPackagingDto;

  /** Target host or base URL for the clone (required for Wave 2 provision). */
  @IsString()
  @MinLength(1)
  targetHost!: string;
}
