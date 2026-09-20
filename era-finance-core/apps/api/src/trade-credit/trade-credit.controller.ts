import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { TradeCreditGrantStatus } from "@erafinance/database";
import { ConfigService } from "@nestjs/config";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { decryptText, normalizeVoen } from "../security/pii-crypto.util";
import {
  resolveControlPlaneServiceToken,
  resolveOrchestratorInternalUrl,
} from "../control-plane/control-plane-credentials";
import { PrismaService } from "../prisma/prisma.service";
import { InviteBuyerPortalDto } from "./dto/invite-buyer-portal.dto";
import { IssueTradeCreditGrantDto } from "./dto/issue-trade-credit-grant.dto";
import { PinTradeCreditPolicyDto } from "./dto/pin-policy.dto";
import { ReclassifyTradeCreditPolicyDto } from "./dto/reclassify-policy.dto";
import { TradeCreditCounterpartyActionDto } from "./dto/trade-credit-counterparty-action.dto";
import { UpdateTradeCreditOrgPolicyDto } from "./dto/update-org-policy.dto";
import { UpsertTradeCreditFacilityDto } from "./dto/upsert-trade-credit-facility.dto";
import { MuteTradeCreditRaiseDto } from "./dto/mute-raise.dto";
import { TradeCreditPolicyService } from "./trade-credit-policy.service";
import { TradeCreditPhase2Service } from "./trade-credit-phase2.service";
import { TradeCreditService } from "./trade-credit.service";

@ApiTags("trade-credit")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(PermissionsGuard)
export class TradeCreditController {
  constructor(
    private readonly tradeCredit: TradeCreditService,
    private readonly policy: TradeCreditPolicyService,
    private readonly phase2: TradeCreditPhase2Service,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get("counterparties/:id/trade-credit")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "Trade credit facility view for finance staff (includes A–D policy fields)",
  })
  getFacility(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) counterpartyId: string,
  ) {
    return this.tradeCredit.getStaffFacilityView(
      organizationId,
      counterpartyId,
    );
  }

  @Put("counterparties/:id/trade-credit")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Upsert trade credit facility (limit / stop-list)" })
  upsertFacility(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) counterpartyId: string,
    @Body() dto: UpsertTradeCreditFacilityDto,
  ) {
    return this.tradeCredit.upsertFacility(organizationId, counterpartyId, dto);
  }

  @Post("trade-credit/grants")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Issue pickup grant; plaintext code returned once",
  })
  async issueGrant(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: IssueTradeCreditGrantDto,
  ) {
    const issued = await this.tradeCredit.issueGrant({
      organizationId,
      counterpartyId: dto.counterpartyId,
      amount: dto.amount,
      override: dto.override,
      reason: dto.reason,
      issuedByUserId: user.userId,
      issuedByBuyer: false,
      ttlHours: dto.ttlHours,
    });
    void this.phase2.maybeNotifyGrantIssued({
      organizationId,
      counterpartyId: dto.counterpartyId,
      grantId: issued.id,
      amount: issued.amount,
      expiresAt: issued.expiresAt,
    });
    return issued;
  }

  @Post("trade-credit/grants/:id/void")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Void an ISSUED grant" })
  voidGrant(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.tradeCredit.voidGrant(organizationId, id);
  }

  @Get("trade-credit/grants")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List grants (optional counterparty / status)" })
  listGrants(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId") counterpartyId?: string,
    @Query("status") status?: TradeCreditGrantStatus,
  ) {
    return this.tradeCredit.listGrants(organizationId, {
      counterpartyId,
      status,
    });
  }

  @Get("trade-credit/facilities")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "List trade credit facilities (staff; optional effective policyGroup A–D)",
  })
  listFacilities(
    @OrganizationId() organizationId: string,
    @Query("policyGroup") policyGroup?: string,
  ) {
    const g = policyGroup?.trim().toUpperCase();
    if (g && !["A", "B", "C", "D"].includes(g)) {
      throw new BadRequestException("policyGroup must be A|B|C|D");
    }
    return this.tradeCredit.listFacilities(organizationId, {
      policyGroup: g
        ? (g as "A" | "B" | "C" | "D")
        : undefined,
    });
  }

  @Post("counterparties/:id/trade-credit/invite")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "Invite buyer portal account (calls Orchestrator; requires counterparty VÖEN)",
  })
  async inviteBuyer(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) counterpartyId: string,
    @Body() dto: InviteBuyerPortalDto,
  ) {
    await this.tradeCredit.assertSku(organizationId);
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId, deletedAt: null },
      select: { id: true, taxIdCipher: true },
    });
    if (!cp) {
      throw new BadRequestException("Counterparty not found");
    }
    const voen = normalizeVoen(
      (cp.taxIdCipher ? decryptText(cp.taxIdCipher) : null) ?? "",
    );
    if (voen.length !== 10) {
      throw new BadRequestException(
        "Buyer VÖEN (10 digits) is required for portal invite",
      );
    }

    const orch = resolveOrchestratorInternalUrl(this.config);
    const token = resolveControlPlaneServiceToken(this.config);
    if (!orch || !token) {
      throw new ServiceUnavailableException(
        "Orchestrator URL / service token not configured",
      );
    }

    const res = await fetch(`${orch}/buyer-portal/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId,
        email: dto.email,
        fullName: dto.fullName,
        password: dto.password,
        voen,
        financeCounterpartyId: counterpartyId,
      }),
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }
    if (!res.ok) {
      const msg =
        (json as { message?: string })?.message ||
        text ||
        `Buyer invite failed (${res.status})`;
      throw new BadRequestException(msg);
    }
    return json;
  }

  @Get("trade-credit/policy")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Org trade credit policy defaults" })
  async getOrgPolicy(@OrganizationId() organizationId: string) {
    await this.tradeCredit.assertSku(organizationId);
    return this.policy.getOrgPolicyDefaults(organizationId);
  }

  @Put("trade-credit/policy")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Update org trade credit policy defaults" })
  updateOrgPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateTradeCreditOrgPolicyDto,
  ) {
    return this.policy.updateOrgPolicy(organizationId, dto);
  }

  @Post("trade-credit/policy/pin")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Pin or clear manual A–D group" })
  pinPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: PinTradeCreditPolicyDto,
  ) {
    return this.policy.pinGroup(
      organizationId,
      dto.counterpartyId,
      dto.group ?? null,
    );
  }

  @Post("trade-credit/policy/mute-raise")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Mute or unmute auto-raise / A proposals for a CP" })
  muteRaise(
    @OrganizationId() organizationId: string,
    @Body() dto: MuteTradeCreditRaiseDto,
  ) {
    return this.policy.setAutoRaiseMuted(
      organizationId,
      dto.counterpartyId,
      dto.muted,
    );
  }

  @Post("trade-credit/policy/accept-raise")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Accept proposed credit limit raise" })
  acceptRaise(
    @OrganizationId() organizationId: string,
    @Body() dto: TradeCreditCounterpartyActionDto,
  ) {
    return this.policy.acceptRaise(organizationId, dto.counterpartyId);
  }

  @Post("trade-credit/policy/reject-raise")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Reject proposed credit limit raise" })
  rejectRaise(
    @OrganizationId() organizationId: string,
    @Body() dto: TradeCreditCounterpartyActionDto,
  ) {
    return this.policy.rejectRaise(organizationId, dto.counterpartyId);
  }

  @Post("trade-credit/policy/restore-after-block")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Restore creditLimit from limitBeforeBlock after auto-D",
  })
  async restoreAfterBlock(
    @OrganizationId() organizationId: string,
    @Body() dto: TradeCreditCounterpartyActionDto,
  ) {
    const restored = await this.policy.restoreAfterBlock(
      organizationId,
      dto.counterpartyId,
    );
    void this.phase2.maybeNotifyLimitRestored({
      organizationId,
      counterpartyId: dto.counterpartyId,
      creditLimit: restored.creditLimit,
    });
    return restored;
  }

  @Post("trade-credit/policy/reclassify")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Reclassify one counterparty or all facilities for the org",
  })
  reclassify(
    @OrganizationId() organizationId: string,
    @Body() dto: ReclassifyTradeCreditPolicyDto,
  ) {
    if (dto.counterpartyId) {
      return this.policy.reclassifyCounterparty(
        organizationId,
        dto.counterpartyId,
      );
    }
    return this.policy.reclassifyOrganization(organizationId);
  }

  @Get("trade-credit/limit-decisions")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Phase 3: Accept/Reject decision log (finance-only)",
  })
  listLimitDecisions(@OrganizationId() organizationId: string) {
    return this.policy.listLimitDecisions(organizationId);
  }

  @Get("counterparties/:id/trade-credit/enrichment")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "List finance-only enrichment runs (Phase 2b; never buyer)",
  })
  listEnrichment(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) counterpartyId: string,
  ) {
    return this.phase2.listEnrichmentRuns(organizationId, counterpartyId);
  }

  @Post("counterparties/:id/trade-credit/enrichment")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Deep check (VÖEN / risky taxpayer); meters TRADE_CREDIT_ENRICH",
  })
  runEnrichment(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) counterpartyId: string,
  ) {
    return this.phase2.runDeepCheck({
      organizationId,
      counterpartyId,
      userId: user.userId,
    });
  }
}
