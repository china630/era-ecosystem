import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CodClearingDto {
  @IsString()
  shipmentRef!: string;

  @IsNumber()
  @Min(0)
  totalCod!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  driverShare?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hubShare?: number;
}
