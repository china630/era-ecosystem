import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { AdminBillingService } from "./admin-billing.service";
import { AdminSubscriptionPatchDto } from "./dto/admin-subscription-patch.dto";
import {
  CreatePricingBundleDto,
  UpdatePricingBundleDto,
} from "./dto/pricing-bundle.dto";
import { PatchPricingBundleTrialConfigDto } from "./dto/pricing-bundle-trial-config.dto";
import { PatchBillingGlobalLimitsDto } from "./dto/patch-billing-global-limits.dto";
import { PatchBillingPricingCatalogDto } from "./dto/patch-billing-pricing-catalog.dto";
import { PatchFoundationDto } from "./dto/patch-foundation.dto";
import { PatchPricingModulePriceDto } from "./dto/patch-pricing-module-price.dto";
import { PatchOcrJobsPerOrgMonthDto } from "./dto/patch-ocr-jobs-per-org-month.dto";
import { PatchQuotaUnitPricingDto } from "./dto/patch-quota-unit-pricing.dto";
import { PatchYearlyDiscountDto } from "./dto/patch-yearly-discount.dto";
import { SetBillingPriceDto } from "./dto/set-billing-price.dto";
import { PatchMeterUnitPricingDto } from "./dto/patch-meter-unit-pricing.dto";
import { PatchTierSpendCeilingsDto } from "./dto/patch-tier-spend-ceilings.dto";
import { SetBillingQuotasMatrixDto } from "./dto/set-billing-quotas-matrix.dto";
import { SetTierQuotasDto } from "./dto/set-tier-quotas.dto";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller("v1/admin")
export class AdminBillingController {
  constructor(private readonly admin: AdminBillingService) {}

  @Patch("organizations/:id/subscription")
  patchSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminSubscriptionPatchDto,
  ) {
    return this.admin.patchSubscription(id, dto);
  }

  @Get("config/billing")
  billingConfig() {
    return this.admin.getBillingConfig();
  }

  @Patch("config/billing/price")
  setPrice(@Body() dto: SetBillingPriceDto) {
    return this.admin.setBillingPrice(dto);
  }

  @Patch("config/billing/quotas")
  setQuotas(@Body() dto: SetTierQuotasDto) {
    return this.admin.setTierQuotas(dto);
  }

  @Patch("config/billing/quotas-matrix")
  setQuotasMatrix(@Body() dto: SetBillingQuotasMatrixDto) {
    return this.admin.setBillingQuotasMatrix(dto);
  }

  @Patch("config/billing/meter-unit-pricing")
  patchMeterUnitPricing(@Body() dto: PatchMeterUnitPricingDto) {
    return this.admin.patchMeterUnitPricing(dto);
  }

  @Patch("config/billing/tier-spend-ceilings")
  patchTierSpendCeilings(@Body() dto: PatchTierSpendCeilingsDto) {
    return this.admin.patchTierSpendCeilings(dto);
  }

  @Patch("config/billing/foundation")
  patchFoundation(@Body() dto: PatchFoundationDto) {
    return this.admin.patchFoundation(dto);
  }

  @Patch("config/billing/pricing-catalog")
  patchBillingPricingCatalog(@Body() dto: PatchBillingPricingCatalogDto) {
    return this.admin.patchBillingPricingCatalog(dto);
  }

  @Patch("config/billing/global-limits")
  patchBillingGlobalLimits(@Body() dto: PatchBillingGlobalLimitsDto) {
    return this.admin.patchBillingGlobalLimits(dto);
  }

  @Patch("config/billing/yearly-discount")
  patchYearlyDiscount(@Body() dto: PatchYearlyDiscountDto) {
    return this.admin.patchYearlyDiscount(dto);
  }

  @Patch("config/billing/quota-pricing")
  patchQuotaPricing(@Body() dto: PatchQuotaUnitPricingDto) {
    return this.admin.patchQuotaUnitPricing(dto);
  }

  @Patch("config/billing/ocr-jobs-per-org-month")
  patchOcrJobsPerOrgMonth(@Body() dto: PatchOcrJobsPerOrgMonthDto) {
    return this.admin.patchOcrJobsPerOrgMonth(dto);
  }

  @Post("config/billing/seed-pricing")
  seedPricingCatalog() {
    return this.admin.seedPricingCatalogDefaults();
  }

  @Patch("pricing-modules/:idOrKey")
  patchPricingModule(
    @Param("idOrKey") idOrKey: string,
    @Body() dto: PatchPricingModulePriceDto,
  ) {
    return this.admin.patchPricingModulePrice(idOrKey, dto);
  }

  @Post("pricing-bundles")
  createPricingBundle(@Body() dto: CreatePricingBundleDto) {
    return this.admin.createPricingBundle(dto);
  }

  @Patch("pricing-bundles/:id")
  updatePricingBundle(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingBundleDto,
  ) {
    return this.admin.updatePricingBundle(id, dto);
  }

  @Patch("pricing-bundles/:id/trial-config")
  patchPricingBundleTrialConfig(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchPricingBundleTrialConfigDto,
  ) {
    return this.admin.patchPricingBundleTrialConfig(id, dto);
  }

  @Delete("pricing-bundles/:id")
  deletePricingBundle(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.deletePricingBundle(id);
  }
}
