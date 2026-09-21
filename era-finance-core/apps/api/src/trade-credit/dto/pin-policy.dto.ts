import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDefined, IsIn, IsUUID, ValidateIf } from "class-validator";

const GROUPS = ["A", "B", "C", "D"] as const;

export class PinTradeCreditPolicyDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiPropertyOptional({
    description: "A|B|C|D or null to clear manual pin",
    nullable: true,
    enum: [...GROUPS, null],
  })
  @IsDefined()
  @ValidateIf((_, v) => v !== null)
  @IsIn([...GROUPS])
  group!: "A" | "B" | "C" | "D" | null;
}
