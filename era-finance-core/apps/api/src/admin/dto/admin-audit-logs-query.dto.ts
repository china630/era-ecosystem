import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class AdminAuditLogsQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Matches `AuditLog.entityType` (e.g. Invoice, Employee). */
  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  /** Prefer dateFrom (YYYY-MM-DD Baku). Legacy `from` still accepted. */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  /** @deprecated use dateFrom */
  @IsOptional()
  @IsString()
  from?: string;

  /** @deprecated use dateTo */
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
