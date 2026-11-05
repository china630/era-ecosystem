import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

const SATELLITE_KEYS = ["hotel", "clinic", "fnb", "retail"] as const;

export class UpsertOrgPaymentMethodDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @MaxLength(120)
  nameAz!: string;

  @IsString()
  @MaxLength(120)
  nameRu!: string;

  @IsString()
  @MaxLength(120)
  nameEn!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsIn(["CASH", "CARD", "NONE"])
  fiscalHint!: "CASH" | "CARD" | "NONE";

  @IsOptional()
  @IsUUID()
  fiscalDeviceId?: string | null;

  @IsArray()
  @IsString({ each: true })
  satellites!: string[];

  @IsOptional()
  @IsObject()
  secrets?: Record<string, string> | null;
}

export { SATELLITE_KEYS };
