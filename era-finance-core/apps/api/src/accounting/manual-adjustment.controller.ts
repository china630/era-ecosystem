import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { LedgerType } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgPolicySubject } from "../auth/policies/policy-subject";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateManualAdjustmentDto } from "./dto/create-manual-adjustment.dto";
import { ReverseManualAdjustmentDto } from "./dto/reverse-manual-adjustment.dto";
import {
  MANUAL_ADJUSTMENT_TEMPLATES,
  type ManualAdjustmentTemplate,
} from "./manual-adjustment.constants";
import { ManualAdjustmentService } from "./manual-adjustment.service";

@ApiTags("accounting")
@ApiBearerAuth("bearer")
@Controller("accounting/manual-adjustments")
export class ManualAdjustmentController {
  constructor(private readonly adjustments: ManualAdjustmentService) {}

  @Get("templates")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Suggested Dt/Ct account codes for a voucher template" })
  suggest(
    @OrganizationId() organizationId: string,
    @Query("template") template: string,
    @Query("ledgerType") ledgerTypeRaw?: string,
  ) {
    const t = MANUAL_ADJUSTMENT_TEMPLATES.includes(
      template as ManualAdjustmentTemplate,
    )
      ? (template as ManualAdjustmentTemplate)
      : "FREEFORM";
    const ledgerType =
      ledgerTypeRaw?.trim().toUpperCase() === "IFRS"
        ? LedgerType.IFRS
        : LedgerType.NAS;
    return this.adjustments.suggestLines(organizationId, t, ledgerType);
  }

  @Post("preview")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Validate and preview manual adjustment lines without posting" })
  preview(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateManualAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adjustments.preview(organizationId, dto, requireOrgPolicySubject(user));
  }

  @Get(":id/pdf")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVOICES_CREATE)
  @Header("Content-Type", "application/pdf")
  @ApiOperation({ summary: "Download internal accounting certificate PDF (not a credit note)" })
  async pdf(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const buf = await this.adjustments.renderPdf(organizationId, id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="adjustment-${id.slice(0, 8)}.pdf"`,
    );
    res.send(buf);
  }

  @Get(":id")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_INVOICES_CREATE)
  @ApiOperation({ summary: "Get one manual adjustment with journal lines" })
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.adjustments.getOne(organizationId, id);
  }

  @Post(":id/reverse")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Reverse a posted manual adjustment with a mirror voucher" })
  reverse(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: ReverseManualAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adjustments.reverse(organizationId, id, dto, requireOrgPolicySubject(user));
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List posted manual adjusting journals" })
  list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("ledgerType") ledgerTypeRaw?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ) {
    const ledgerType =
      ledgerTypeRaw?.trim().toUpperCase() === "IFRS"
        ? LedgerType.IFRS
        : ledgerTypeRaw?.trim().toUpperCase() === "MANAGEMENT"
          ? LedgerType.MANAGEMENT
        : ledgerTypeRaw?.trim().toUpperCase() === "NAS"
          ? LedgerType.NAS
          : undefined;
    return this.adjustments.list(organizationId, {
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      ledgerType,
      accountingBookId,
      actingUserRole: requireOrgPolicySubject(user),
    });
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "Post a manual adjusting journal (əl ilə tənzimləmə). Does not mutate existing documents.",
  })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateManualAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adjustments.create(organizationId, dto, requireOrgPolicySubject(user));
  }
}
