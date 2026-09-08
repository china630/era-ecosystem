import {
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { LedgerMappingService } from "./ledger-mapping.service";
import { IfrsAutoMappingService } from "./ifrs-auto-mapping.service";
import { SubcontoService } from "./subconto.service";

class LedgerMappingLineDto {
  @IsUUID()
  sourceAccountId!: string;

  @IsUUID()
  targetAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ratio?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class ReplaceLedgerMappingLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerMappingLineDto)
  lines!: LedgerMappingLineDto[];
}

class CreateBookMappingSetDto {
  @IsUUID()
  fromBookId!: string;

  @IsUUID()
  toBookId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code?: string;
}

@ApiTags("ledger-mappings")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.IFRS_MAPPING)
@Controller("accounting/ledger-mappings")
export class LedgerMappingController {
  constructor(
    private readonly mappings: LedgerMappingService,
    private readonly ifrsMirror: IfrsAutoMappingService,
    private readonly subconto: SubcontoService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List accounting book mapping sets (versions)" })
  list(@OrganizationId() organizationId: string) {
    return this.mappings.listSets(organizationId);
  }

  @Get("coverage")
  @ApiOperation({ summary: "NAS→IFRS mapping coverage for published or given set" })
  coverage(
    @OrganizationId() organizationId: string,
    @Query("setId") setId?: string,
  ) {
    return this.mappings.coverage(organizationId, setId);
  }

  @Post("draft")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Ensure/create DRAFT set (clone from published if empty)" })
  createDraft(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateBookMappingSetDto,
  ) {
    return this.mappings.createDraftForPair(
      organizationId,
      dto.fromBookId,
      dto.toBookId,
      dto.code,
    );
  }

  @Get("failed-mirrors")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Transactions with mirrorStatus=FAILED" })
  failed(
    @OrganizationId() organizationId: string,
    @Query("take") take?: string,
  ) {
    const n = take != null ? Number(take) : 100;
    return this.mappings.listFailedMirrors(
      organizationId,
      Number.isFinite(n) ? n : 100,
    );
  }

  @Post("mirror/retry/:transactionId")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Retry soft FAILED IFRS mirror" })
  retry(
    @OrganizationId() organizationId: string,
    @Param("transactionId", ParseUUIDPipe) transactionId: string,
  ) {
    return this.ifrsMirror.retryFailedMirror(
      organizationId,
      transactionId,
      this.subconto,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get mapping set with lines" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mappings.getSet(organizationId, id);
  }

  @Patch(":id/lines")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Replace all lines on a DRAFT set" })
  replaceLines(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReplaceLedgerMappingLinesDto,
  ) {
    return this.mappings.replaceDraftLines(organizationId, id, dto.lines);
  }

  @Post(":id/publish")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Publish DRAFT set (archives previous PUBLISHED)" })
  publish(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mappings.publish(organizationId, id, user.userId);
  }
}

/** Legacy AccountMapping write/read — P0 cutover returns 410 on mutations. */
export function legacyMappingGone(): never {
  throw new GoneException({
    code: "LEGACY_MAPPING_GONE",
    message:
      "Legacy AccountMapping / IfrsMappingRule write APIs are closed. Use /api/accounting/ledger-mappings",
  });
}
