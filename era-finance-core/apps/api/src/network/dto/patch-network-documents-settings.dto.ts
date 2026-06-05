import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class PatchNetworkDocumentsSettingsDto {
  @ApiProperty()
  @IsBoolean()
  acceptInbound!: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoPostSafeRoles?: string[];
}
