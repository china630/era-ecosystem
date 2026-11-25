import { Module } from "@nestjs/common";
import { KitApiController } from "../kit-api.controller";
import { AdminHotelRevenueCodesController } from "./controllers/admin_hotel-revenue-codes";
import { AdminLinksController } from "./controllers/admin_links";
import { AdminOutletsController } from "./controllers/admin_outlets";
import { AdminOutletsIdController } from "./controllers/admin_outlets__id";
import { AdminProductCategoriesController } from "./controllers/admin_product-categories";
import { AdminProductCategoriesIdController } from "./controllers/admin_product-categories__id";
import { AdminProductsController } from "./controllers/admin_products";
import { AdminProductsIdController } from "./controllers/admin_products__id";
import { AdminRolesController } from "./controllers/admin_roles";
import { AdminRolesCodeController } from "./controllers/admin_roles__code";
import { AdminRolesCodePermissionsController } from "./controllers/admin_roles__code_permissions";
import { AdminUserLoginsController } from "./controllers/admin_user-logins";
import { AdminUsersController } from "./controllers/admin_users";
import { AuthLoginController } from "./controllers/auth_login";
import { AuthLogoutController } from "./controllers/auth_logout";
import { AuthMeController } from "./controllers/auth_me";
import { AuthSessionRefreshPermissionsController } from "./controllers/auth_session_refresh-permissions";
import { AuthSsoExchangeController } from "./controllers/auth_sso_exchange";
import { EditionController } from "./controllers/edition";
import { EventsDispatchController } from "./controllers/events_dispatch";
import { FiscalDevicesController } from "./controllers/fiscal_devices";
import { HealthController } from "./controllers/health";
import { ImportController } from "./controllers/import";
import { ImportEntityController } from "./controllers/import__entity";
import { IntegrationsMarketplaceController } from "./controllers/integrations_marketplace";
import { IntegrationPrescriptionQueueController } from "./controllers/integration_prescription-queue";
import { IntegrationPrescriptionQueueIdController } from "./controllers/integration_prescription-queue__id";
import { IntegrationPrescriptionReserveController } from "./controllers/integration_prescription-reserve";
import { IntegrationSettlementConfirmedController } from "./controllers/integration_settlement-confirmed";
import { IntegrationStaffProvisionController } from "./controllers/integration_staff-provision";
import { IntegrationStockWriteOffController } from "./controllers/integration_stock-write-off";
import { InternalV1ShiftsOpenController } from "./controllers/internal_v1_shifts_open";
import { InternalV1WorkforceRolesController } from "./controllers/internal_v1_workforce_roles";
import { LocaleController } from "./controllers/locale";
import { OfflineSyncController } from "./controllers/offline_sync";
import { PlatformBillingSnapshotController } from "./controllers/platform_billing-snapshot";
import { PresetsController } from "./controllers/presets";
import { ProductsSearchController } from "./controllers/products_search";
import { ReceiptsController } from "./controllers/receipts";
import { ReceiptsIdApplyPromoController } from "./controllers/receipts__id_apply-promo";
import { ReceiptsIdBopisController } from "./controllers/receipts__id_bopis";
import { ReceiptsIdLinesLineIdVoidController } from "./controllers/receipts__id_lines__lineId_void";
import { ReceiptsIdPayController } from "./controllers/receipts__id_pay";
import { ReceiptsIdReturnController } from "./controllers/receipts__id_return";
import { ReceiptsIdVoidController } from "./controllers/receipts__id_void";
import { ReplenishmentSuggestionsController } from "./controllers/replenishment_suggestions";
import { ShiftsCloseController } from "./controllers/shifts_close";
import { ShiftsOpenController } from "./controllers/shifts_open";
import { ShiftsIdXReportController } from "./controllers/shifts__id_x-report";
import { StockCheckController } from "./controllers/stock_check";
import { SuppliersInvoicesMatchController } from "./controllers/suppliers_invoices_match";
import { UploadsController } from "./controllers/uploads";

@Module({
  controllers: [
    KitApiController,
    AdminHotelRevenueCodesController,
    AdminLinksController,
    AdminOutletsController,
    AdminOutletsIdController,
    AdminProductCategoriesController,
    AdminProductCategoriesIdController,
    AdminProductsController,
    AdminProductsIdController,
    AdminRolesController,
    AdminRolesCodeController,
    AdminRolesCodePermissionsController,
    AdminUserLoginsController,
    AdminUsersController,
    AuthLoginController,
    AuthLogoutController,
    AuthMeController,
    AuthSessionRefreshPermissionsController,
    AuthSsoExchangeController,
    EditionController,
    EventsDispatchController,
    FiscalDevicesController,
    HealthController,
    ImportController,
    ImportEntityController,
    IntegrationsMarketplaceController,
    IntegrationPrescriptionQueueController,
    IntegrationPrescriptionQueueIdController,
    IntegrationPrescriptionReserveController,
    IntegrationSettlementConfirmedController,
    IntegrationStaffProvisionController,
    IntegrationStockWriteOffController,
    InternalV1ShiftsOpenController,
    InternalV1WorkforceRolesController,
    LocaleController,
    OfflineSyncController,
    PlatformBillingSnapshotController,
    PresetsController,
    ProductsSearchController,
    ReceiptsController,
    ReceiptsIdApplyPromoController,
    ReceiptsIdBopisController,
    ReceiptsIdLinesLineIdVoidController,
    ReceiptsIdPayController,
    ReceiptsIdReturnController,
    ReceiptsIdVoidController,
    ReplenishmentSuggestionsController,
    ShiftsCloseController,
    ShiftsOpenController,
    ShiftsIdXReportController,
    StockCheckController,
    SuppliersInvoicesMatchController,
    UploadsController,
  ],
})
export class RetailNativeModule {}
