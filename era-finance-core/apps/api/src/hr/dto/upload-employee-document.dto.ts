import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { EmployeeDocumentKind } from "@erafinance/database";

export class UploadEmployeeDocumentDto {
  @ApiProperty({ enum: EmployeeDocumentKind })
  @IsEnum(EmployeeDocumentKind)
  kind!: EmployeeDocumentKind;
}
