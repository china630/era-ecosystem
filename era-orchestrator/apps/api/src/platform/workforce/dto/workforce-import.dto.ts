import { IsOptional, IsString } from "class-validator";

export class ImportCsvDto {
  @IsOptional()
  @IsString()
  csv?: string;

  /** Base64 .xlsx (same columns as CSV). Converted server-side. */
  @IsOptional()
  @IsString()
  xlsxBase64?: string;
}
