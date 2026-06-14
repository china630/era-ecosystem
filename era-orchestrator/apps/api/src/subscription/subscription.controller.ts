import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BillingStatus, UserRole } from "@era365/database";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { AccessControlService } from "../access/access-control.service";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaService } from "../quota/quota.service";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteConnectService } from "./satellite-connect.service";
import { SubscriptionAccessService } from "./subscription-access.service";
import { TrialEntitlementResolver } from "./trial-entitlement.resolver";
import { buildHotelModuleEntitlements } from "./hotel-module-entitlements.util";
import { ConnectSatelliteDto } from "./dto/connect-satellite.dto";
import { SelectPlanDto } from "./dto/select-plan.dto";
import { UpdateSubscriptionModulesDto } from "./dto/update-subscription-modules.dto";
@ApiTags("subscription")
@ApiBearerAuth("bearer")
@Controller("v1/subscription")
export class SubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly accessControl: AccessControlService,
    private readonly quota: QuotaService,
    private readonly prisma: PrismaService,
    private readonly connect: SatelliteConnectService,
    private readonly trialResolver: TrialEntitlementResolver,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Текущий тариф, модули и квоты организации (для UI)",
  })
  async getMe(@OrganizationId() organizationId: string) {
    /** Сначала снимок подписки (lazy-create строки) — иначе квоты в parallel получают 404. */
    const snapshot = await this.access.getOrganizationSnapshot(organizationId);
    const [employees, invoicesThisMonth, storage, org] = await Promise.all([
      this.quota.getEmployeeQuotaSnapshot(organizationId),
      this.quota.getInvoiceMonthlyQuotaSnapshot(organizationId),
      this.quota.getStorageQuotaSnapshot(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          billingStatus: true,
          whatsappAlertsUsed: true,
          operatingMode: true,
          parentOrgId: true,
          fiscalRouting: true,
          revenueRouting: true,
        },
      }),
    ]);
    const expiresAt = snapshot.expiresAt;
    const now = Date.now();
    const readOnly =
      expiresAt != null && expiresAt.getTime() < now;

    let trialDaysLeft: number | null = null;
    if (snapshot.isTrial && expiresAt) {
      const expMs = expiresAt.getTime();
      if (expMs > now) {
        trialDaysLeft = Math.ceil((expMs - now) / 86_400_000);
      }
    }

    const waBalance = org?.whatsappAlertsUsed ?? 0;
    const [satelliteEntitlements, moduleTrials, connectableSatellites] =
      await Promise.all([
        this.trialResolver.listSatelliteEntitlements(organizationId),
        this.trialResolver.listModuleTrials(organizationId),
        this.trialResolver.listConnectableSatelliteKeys(organizationId),
      ]);
    return {
      tier: snapshot.tier,
      activeModules: snapshot.activeModules,
      customConfig: snapshot.customConfig,
      modules: snapshot.modules,
      hotelModules: buildHotelModuleEntitlements(snapshot.activeModules),
      satelliteEntitlements: satelliteEntitlements.map((s) => ({
        satelliteKey: s.satelliteKey,
        trialExpiresAt: s.trialExpiresAt?.toISOString() ?? null,
        trialOverridden: s.trialOverridden,
        connectedAt: s.connectedAt.toISOString(),
        isTrial: s.isTrial,
      })),
      moduleTrials: moduleTrials.map((m) => ({
        moduleKey: m.moduleKey,
        trialExpiresAt: m.trialExpiresAt?.toISOString() ?? null,
        trialOverridden: m.trialOverridden,
      })),
      connectableSatellites,
      operatingMode: {
        mode: org?.operatingMode ?? "STANDALONE",
        parentOrgId: org?.parentOrgId ?? null,
        fiscalRouting: org?.fiscalRouting ?? "OWN",
        revenueRouting: org?.revenueRouting ?? "OWN",
      },
      expiresAt: expiresAt?.toISOString() ?? null,
      isTrial: snapshot.isTrial,
      billingStatus: org?.billingStatus ?? BillingStatus.ACTIVE,
      readOnly,
      trialDaysLeft,
      quotas: {
        employees,
        invoicesThisMonth,
        storage,
        whatsappOutbound: {
          balance: waBalance,
          atLimit: waBalance <= 0,
        },
      },
    };
  }

  @Post("connect-satellite")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: "Materialize trial satellite + allowlisted modules" })
  async connectSatellite(
    @CurrentUser() user: EraJwtPayload,
    @OrganizationId() organizationId: string,
    @Body() dto: ConnectSatelliteDto,
  ) {
    await this.accessControl.assertOwnerForBilling(user.sub, organizationId);
    await this.connect.connectSatellite(organizationId, dto.satelliteKey);
    return this.getMe(organizationId);
  }

  @Post("select-plan")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: "Смена тарифа (мок, без оплаты)" })
  async selectPlan(
    @CurrentUser() user: EraJwtPayload,
    @OrganizationId() organizationId: string,
    @Body() dto: SelectPlanDto,
  ) {
    await this.accessControl.assertOwnerForBilling(user.sub, organizationId);
    await this.access.updateTier(organizationId, dto.tier);
    return this.getMe(organizationId);
  }

  @Patch("modules")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      "Включение/выключение модулей подписки (каталог + legacy production/ifrs)",
  })
  async patchModules(
    @CurrentUser() user: EraJwtPayload,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateSubscriptionModulesDto,
  ) {
    await this.accessControl.assertOwnerForBilling(user.sub, organizationId);
    await this.access.updateModuleAddons(organizationId, dto);
    return this.getMe(organizationId);
  }
}
