import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/** SEC-FIN-08: validated inbound network document body (no type-only trust). */
export class ReceiveNetworkDocumentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  correlationId!: string;

  @IsUUID()
  issuerOrganizationId!: string;

  @IsUUID()
  recipientOrganizationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sourceInvoiceId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8)
  currency!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  totalNet!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  vatAmount!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  totalGross!: string;

  @IsArray()
  lines!: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  issuerInvoiceNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  issuerTaxIdBlindIndex?: string | null;
}
