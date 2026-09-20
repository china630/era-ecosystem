import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsUUID } from "class-validator";

export class MuteTradeCreditRaiseDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({ description: "Mute auto-raise / A proposals for this CP" })
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  muted!: boolean;
}
