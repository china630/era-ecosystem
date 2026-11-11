import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CP_PERMISSION } from "../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BillingStatus } from "@era365/database";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { AccessControlService } from "../access/access-control.service";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaService } from "../quota/quota.service";
import { BillingSatelliteNotifyService } from "../billing/billing-satellite-notify.service";
import { SatelliteConnectService } from "./satellite-connect.service";
import { SubscriptionAccessService } from "./subscription-access.service";
import { TrialEntitlementResolver } from "./trial-entitlement.resolver";
import { buildHotelModuleEntitlements } from "./hotel-module-entitlements.util";
import { buildSettlementPolicy } from "./settlement-policy.util";
import { ConnectSatelliteDto } from "./dto/connect-satellite.dto";
import { SelectPlanDto } from "./dto/select-plan.dto";
import { UpdateSubscriptionModulesDto } from "./dto/update-subscription-modules.dto";
import { SatelliteChannelsService } from "../channels/satellite-channels.service";
@ApiTags("subscription")
@ApiBearerAuth("bearer")
@Controller("v1/subscription")
export class SubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly accessControl: AccessControlService,
    private readonly quota: QuotaService,
    private readonly connect: SatelliteConnectService,
    private readonly trialResolver: TrialEntitlementResolver,
    private readonly moduleRef: ModuleRef,
    private readonly channels: SatelliteChannelsService,
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
      this.access.findOrganizationForSubscriptionMe(organizationId),
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
    const [satelliteEntitlements, moduleTrials, connectableSatellites, parentOrg, deptChildCount] =
      await Promise.all([
        this.trialResolver.listSatelliteEntitlements(organizationId),
        this.trialResolver.listModuleTrials(organizationId),
        this.trialResolver.listConnectableSatelliteKeys(organizationId),
        org?.parentOrgId
          ? this.access.findParentOrganizationForSettlement(org.parentOrgId)
          : Promise.resolve(null),
        org?.operatingMode === "STANDALONE"
          ? this.access.countDepartmentChildrenWithParentFiscal(organizationId)
          : Promise.resolve(0),
      ]);
    const settlementPolicy = org
      ? buildSettlementPolicy(org, {
          parentOrg,
          departmentChildCount: deptChildCount,
        })
      : buildSettlementPolicy({
          id: organizationId,
          operatingMode: "STANDALONE",
          parentOrgId: null,
          fiscalRouting: "OWN",
          settings: {},
        });

    const connectedSatelliteKeys = [
      ...new Set(satelliteEntitlements.map((s) => s.satelliteKey)),
    ];
    let activeModules = [...snapshot.activeModules];
    if (connectedSatelliteKeys.length > 0) {
      const freeModules =
        await this.access.findFreePricingModulesBySatelliteKeys(
          connectedSatelliteKeys,
        );
      activeModules = [
        ...new Set([...activeModules, ...freeModules.map((m) => m.key)]),
      ];
    }

    return {
      tier: snapshot.tier,
      publicOrgNumber: org?.publicOrgNumber ?? null,
      activeModules,
      customConfig: snapshot.customConfig,
      modules: snapshot.modules,
      hotelModules: buildHotelModuleEntitlements(activeModules),
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
      channels: await this.channels
        .listSnapshotForOrganization(organizationId)
        .catch(() => []),
      settlementPolicy,
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_BILLING_MANAGE)
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_BILLING_MANAGE)
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_BILLING_MANAGE)
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
    try {
      const notify = this.moduleRef.get(BillingSatelliteNotifyService, {
        strict: false,
      });
      await notify.afterModuleChange(organizationId);
    } catch {
      /* best-effort; billing row already saved */
    }
    return this.getMe(organizationId);
  }
}
