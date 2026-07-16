import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class CreateProfitTaxAdjustmentDto {
  @ApiProperty({ example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ enum: ["PERMANENT", "TEMPORARY"] })
  @IsString()
  @IsIn(["PERMANENT", "TEMPORARY"])
  kind!: "PERMANENT" | "TEMPORARY";

  @ApiProperty({ example: "PENALTY_NON_DEDUCTIBLE" })
  @IsString()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: "Non-deductible fines and penalties" })
  @IsString()
  @MaxLength(512)
  description!: string;

  @ApiProperty({
    description: "Signed adjustment amount (AZN); increases taxable base when positive",
    example: "1500.00",
  })
  @IsString()
  @Matches(/^-?\d+(\.\d{1,4})?$/)
  amount!: string;
}
