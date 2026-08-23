import { IsOptional, IsString, MinLength } from "class-validator";

export class ImportCsvDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  csv?: string;

  /** Base64 .xlsx (same columns as CSV). Converted server-side. */
  @IsOptional()
  @IsString()
  xlsxBase64?: string;
}
