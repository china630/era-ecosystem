import {
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateIf,
} from "class-validator";

export class UpsertClinicCutoverDto {
  @IsBoolean()
  elektrawebDualRun!: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  hotelOrganizationId?: string | null;
}
