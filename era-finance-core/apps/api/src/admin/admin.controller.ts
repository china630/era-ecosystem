import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { AuthService } from "../auth/auth.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { AdminCatalogService } from "./admin-catalog.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { AdminService } from "./admin.service";
import { TranslationUpsertDto } from "./dto/translation-upsert.dto";
import { PatchTranslationOverrideDto } from "./dto/patch-translation-override.dto";
import { PutSystemConfigDto } from "./dto/put-system-config.dto";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@Controller("admin")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
    private readonly systemConfig: SystemConfigService,
    private readonly catalog: AdminCatalogService,
  ) {}

  @Get("stats")
  @ApiOperation({ summary: "Сводная статистика платформы" })
  stats() {
    return this.admin.getStats();
  }

  /** Должен быть объявлен до GET users, иначе сегмент `users` перехватится как :userId. */
  @Get("users/:userId/organizations")
  @ApiOperation({
    summary: "Организации пользователя и подписки (супер-админ, без фильтра тенанта)",
  })
  userOrganizations(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.admin.getUserOrganizations(userId);
  }

  @Get("users")
  @ApiOperation({
    summary: "Список всех пользователей платформы (пагинация, поиск по email/имени)",
  })
  users(@Query("q") q?: string, @Query("page") pageRaw?: string, @Query("pageSize") pageSizeRaw?: string) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20),
    );
    return this.admin.listUsers(q, page, pageSize);
  }

  @Get("organizations")
  @ApiOperation({ summary: "Список организаций (пагинация, поиск по VÖEN/названию)" })
  organizations(@Query("q") q?: string, @Query("page") pageRaw?: string, @Query("pageSize") pageSizeRaw?: string) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20),
    );
    return this.admin.listOrganizations(q, page, pageSize);
  }

  @Get("translations")
  @ApiOperation({
    summary:
      "Список ключей i18n: дефолты из resources + переопределения из БД",
  })
  translations(
    @Query("locale") locale = "az",
    @Query("q") q?: string,
    @Query("skip") skipRaw?: string,
    @Query("take") takeRaw?: string,
  ) {
    const skip = Math.max(0, Number.parseInt(skipRaw ?? "0", 10) || 0);
    const take = Math.min(
      50000,
      Math.max(1, Number.parseInt(takeRaw ?? "20000", 10) || 20000),
    );
    return this.admin.listTranslations(locale, q, skip, take);
  }

  @Post("translations")
  @ApiOperation({ summary: "Создать или обновить строку перевода" })
  upsertTranslation(@Body() dto: TranslationUpsertDto) {
    return this.admin.upsertTranslation(dto);
  }

  @Patch("translations/:id")
  @ApiOperation({ summary: "Update translation override value and/or soft-disable (no hard delete)" })
  patchTranslation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchTranslationOverrideDto,
  ) {
    return this.admin.patchTranslationOverride(id, dto);
  }

  @Post("translations/sync")
  @ApiOperation({
    summary: "Сбросить версию кэша i18n (клиенты перезагружают переводы)",
  })
  syncTranslations() {
    return this.admin.syncTranslationsCache();
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "Глобальный журнал AuditLog" })
  auditLogs(
    @Query("organizationId") organizationId?: string,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("skip") skipRaw?: string,
    @Query("take") takeRaw?: string,
  ) {
    const skip = Math.max(0, Number.parseInt(skipRaw ?? "0", 10) || 0);
    const take = Math.min(
      200,
      Math.max(1, Number.parseInt(takeRaw ?? "50", 10) || 50),
    );
    return this.admin.globalAuditLogs({
      organizationId,
      userId,
      from,
      to,
      skip,
      take,
    });
  }

  @Get("chart-template")
  @ApiOperation({
    summary:
      "Глобальный шаблон NAS (chart_of_accounts_entries) — источник для новых организаций",
  })
  chartTemplateList(@Query("withUsage") withUsage?: string) {
    const inc = withUsage === "1" || withUsage === "true";
    return this.admin.listChartTemplateEntries(inc);
  }

  @Patch("chart-template/:id")
  @ApiOperation({ summary: "Disabled — NAS template owned by era-data-hub (Phase 2)" })
  chartTemplatePatch() {
    throw new GoneException(
      "NAS chart template writes moved to era-data-hub (Data-Hub Phase 2)",
    );
  }

  @Post("chart-template")
  @ApiOperation({ summary: "Disabled — NAS template owned by era-data-hub (Phase 2)" })
  chartTemplateUpsert() {
    throw new GoneException(
      "NAS chart template writes moved to era-data-hub (Data-Hub Phase 2)",
    );
  }

  @Get("system-config")
  @ApiOperation({ summary: "Platform system_config rows (whitelist, Super-Admin)" })
  listSystemConfig() {
    return this.systemConfig.listAdminSystemConfigRows();
  }

  @Put("system-config/:key")
  @ApiOperation({ summary: "Upsert a whitelisted system_config key" })
  putSystemConfig(@Param("key") key: string, @Body() dto: PutSystemConfigDto) {
    return this.systemConfig
      .putAdminSystemConfig(decodeURIComponent(key), dto.value)
      .then(() => ({ ok: true }));
  }

  @Post("system-config/:key/reset")
  @ApiOperation({ summary: "Remove DB row so built-in defaults apply" })
  resetSystemConfig(@Param("key") key: string) {
    return this.systemConfig
      .resetAdminSystemConfig(decodeURIComponent(key))
      .then(() => ({ ok: true }));
  }

  @Get("currencies")
  @ApiOperation({ summary: "All currencies with relation usage counts (local FK cache)" })
  adminCurrencies() {
    return this.catalog.listCurrencies();
  }

  @Post("currencies")
  @ApiOperation({ summary: "Disabled — Currency catalog owned by era-data-hub" })
  adminCreateCurrency() {
    throw new GoneException(
      "Currency catalog writes moved to era-data-hub (ISO SoR + Finance FK cache)",
    );
  }

  @Patch("currencies/:id")
  @ApiOperation({ summary: "Disabled — Currency catalog owned by era-data-hub" })
  adminPatchCurrency() {
    throw new GoneException(
      "Currency catalog writes moved to era-data-hub (ISO SoR + Finance FK cache)",
    );
  }

  @Get("units-of-measure")
  @ApiOperation({ summary: "Units of measure with usage counts" })
  adminUom() {
    return this.catalog.listUnitsOfMeasure();
  }

  @Post("units-of-measure")
  @ApiOperation({ summary: "Disabled — UoM owned by era-data-hub (Phase 2)" })
  adminCreateUom() {
    throw new GoneException("Units of measure writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Patch("units-of-measure/:id")
  @ApiOperation({ summary: "Disabled — UoM owned by era-data-hub (Phase 2)" })
  adminPatchUom() {
    throw new GoneException("Units of measure writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Get("tax-rates")
  @ApiOperation({ summary: "Tax rates with usage counts" })
  adminTaxRates() {
    return this.catalog.listTaxRates();
  }

  @Post("tax-rates")
  @ApiOperation({ summary: "Disabled — tax rates owned by era-data-hub (Phase 2)" })
  adminCreateTaxRate() {
    throw new GoneException("Tax rate writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Patch("tax-rates/:id")
  @ApiOperation({ summary: "Disabled — tax rates owned by era-data-hub (Phase 2)" })
  adminPatchTaxRate() {
    throw new GoneException("Tax rate writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Get("template-accounts")
  @ApiOperation({ summary: "Global NAS template accounts" })
  adminTemplateAccounts() {
    return this.catalog.listTemplateAccounts();
  }

  @Post("template-accounts")
  @ApiOperation({ summary: "Disabled — NAS templates owned by era-data-hub (Phase 2)" })
  adminUpsertTemplateAccount() {
    throw new GoneException("Template account writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Patch("template-accounts/:id")
  @ApiOperation({ summary: "Disabled — NAS templates owned by era-data-hub (Phase 2)" })
  adminPatchTemplateAccount() {
    throw new GoneException("Template account writes moved to era-data-hub (Data-Hub Phase 2)");
  }

  @Get("reference/snapshot")
  @ApiOperation({ summary: "Enums and contract whitelists (read-only)" })
  adminReferenceSnapshot() {
    return this.catalog.getReferenceSnapshot();
  }

  @Post("impersonate/:userId")
  @ApiOperation({
    summary: "Войти от имени пользователя (поддержка); refresh — в cookie",
  })
  async impersonate(
    @CurrentUser() admin: AuthUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.impersonate(admin.userId, userId);
    this.auth.setRefreshCookie(res, out.refreshToken);
    const { refreshToken: _r, ...body } = out;
    return body;
  }
}
