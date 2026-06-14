import { IsString, MinLength } from "class-validator";

export class ConnectSatelliteDto {
  @IsString()
  @MinLength(2)
  satelliteKey!: string;
}
