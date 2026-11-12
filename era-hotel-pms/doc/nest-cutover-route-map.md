# Hotel API cutover map (Next route handlers)

Generated inventory for the Nest move. Algorithms stay in services. This file records the HTTP edge only.
Regenerate: `node scripts/nest-cutover-route-map.mjs` from `era-hotel-pms`.

- Route files: 395
- Handlers: 544
- Files that re-export handlers (not inlined in this hotel file, still edges): `GET`+`POST` `/api/internal/v1/organization/bind` (`createOrganizationBindHandlers`), `GET`+`POST` `/api/internal/v1/runtime-config` (`createRuntimeConfigHandlers` plus Elektraweb and fiscal hooks), `GET` `/api/platform/billing-status` (kit), `GET` `/api/reports/[slug]` (re-export of `layout/route`).
- Parser saw no inline verb on: /api/internal/v1/organization/bind, /api/internal/v1/runtime-config, /api/platform/billing-status, /api/reports/[slug]
- Those three kit edges are mounted by hand in `nest/kit-routes.ts` (same factories as the Next files).
- Next `app/api/**/route.ts` files for those handlers are removed. Next no longer rewrites `/api` to Nest (`ERA_NEST_CUTOVER` is unused).
- One origin. Local dev: `node scripts/hotel-front.mjs` on port 3220 (Docker already holds 3201) sends `/api` to Nest **13201** and pages to Next **23201**. The container publishes **3201** and uses the same internal ports. The staff cookie stays on that single host. The front door does not cut the request at 30 seconds.
- Staff login cookie `maxAge` is 4 hours (`60 * 60 * 4` seconds), matching `SATELLITE_SESSION_COOKIE_MAX_AGE_MS`.
- Handlers flagged with logic in the route (not only a service call): 163

Columns: method, URL, session/permission, input (query, body schema, path), called service (or helper if no service import), response helper, logic still inside the handler.
`logic = no` means the handler did not touch `prisma` and did not await a local function outside the known service imports. A long helper call list still needs a human look before that URL is moved.

## Counts by first path segment

| Segment | Handlers |
|---|---:|
| admin | 65 |
| agencies | 6 |
| agency | 4 |
| auth | 7 |
| banquets | 15 |
| bookings | 1 |
| business-date | 1 |
| cash | 2 |
| channel | 15 |
| clinic | 1 |
| companies | 6 |
| concierge | 2 |
| counterparties | 1 |
| cron | 3 |
| dispatch | 2 |
| distribution | 10 |
| duty-schedules | 8 |
| executive | 3 |
| fiscal | 1 |
| fleet | 3 |
| fo | 8 |
| folios | 17 |
| front-cash | 9 |
| fx-preview | 1 |
| guests | 61 |
| health | 1 |
| hotel | 8 |
| housekeeping | 39 |
| import | 2 |
| integration | 9 |
| integrations | 10 |
| internal | 13 |
| locale | 1 |
| loyalty | 1 |
| master | 31 |
| mdm | 3 |
| medical | 3 |
| migration | 5 |
| night-audit | 8 |
| notifications | 4 |
| payment-methods | 1 |
| platform | 1 |
| pms | 7 |
| pos | 5 |
| procedures | 3 |
| public | 4 |
| reports | 23 |
| reservation-groups | 7 |
| reservations | 55 |
| room-plan | 1 |
| room-service | 1 |
| rooms | 4 |
| service | 7 |
| settlement | 6 |
| spa | 3 |
| stock | 6 |
| tourism | 2 |
| tours | 15 |
| transfers | 3 |

## admin

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/admin/allotment-blocks/[id]/pickup` | session | body:schema path:id | pickupAllotmentBlock | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/admin/allotment-blocks/[id]` | session | query:pickup path:id | getAllotmentBlock, getAllotmentBlockPickup | jsonOk, handleRouteError | calls:requireHotelModule |
| PATCH | `/api/admin/allotment-blocks/[id]` | session | body:patchSchema path:id | updateAllotmentBlock | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/admin/allotment-blocks` | session | query:status,agencyId | listAllotmentBlocks | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/admin/allotment-blocks` | session | body:createSchema | createAllotmentBlock | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/admin/audit` | session REPORTS_READ | query:entityType,entityId,action,userId,dateFrom,dateTo,limit body:JSON | assertPermission, bakuDayBounds, getSatelliteSession, listAuditLogs | jsonError, jsonOk, handleRouteError | calls:listAuditLogs |
| GET | `/api/admin/auto-bar` | session MASTER_DATA_MANAGE | query:from,to,roomTypeId,baseAmount body:querySchema | previewAutoBar | jsonOk, handleRouteError | no |
| POST | `/api/admin/auto-bar` | session MASTER_DATA_MANAGE | — | applyAutoBar | jsonOk, handleRouteError | no |
| PATCH | `/api/admin/child-matrix/[id]` | session MASTER_DATA_MANAGE | body:schema path:id | updateChildPricingRow | jsonOk, handleRouteError | no |
| DELETE | `/api/admin/child-matrix/[id]` | session MASTER_DATA_MANAGE | path:id | deleteChildPricingRow | jsonOk, handleRouteError | no |
| GET | `/api/admin/child-matrix` | session MASTER_DATA_MANAGE | — | listChildPricingMatrix | jsonOk, handleRouteError | no |
| POST | `/api/admin/child-matrix` | session MASTER_DATA_MANAGE | body:schema | createChildPricingRow | jsonOk, handleRouteError | no |
| GET | `/api/admin/companies` | session MASTER_DATA_MANAGE | — | listCompanies | jsonOk, handleRouteError | no |
| POST | `/api/admin/companies` | session MASTER_DATA_MANAGE | body:schema | upsertCompany | jsonOk, handleRouteError | no |
| PATCH | `/api/admin/contract-pricing/[id]` | see-handler | path:id | — | NextResponse.json | no |
| DELETE | `/api/admin/contract-pricing/[id]` | see-handler | path:id | — | NextResponse.json | no |
| GET | `/api/admin/contract-pricing` | see-handler | — | — | NextResponse.json | no |
| POST | `/api/admin/contract-pricing` | see-handler | — | — | NextResponse.json | no |
| GET | `/api/admin/contracts/[id]/allotments` | session | path:id | listContractAllotments | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/admin/contracts/[id]/allotments` | session | body:upsertSchema path:id | upsertContractAllotment | jsonOk, handleRouteError | calls:requireHotelModule |
| DELETE | `/api/admin/contracts/[id]/allotments` | session | query:allotmentId path:id | deleteContractAllotment | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/admin/contracts/[id]` | session | query:utilization path:id | getContractUtilization, getSalesContract | jsonOk, handleRouteError | calls:requireHotelModule |
| PATCH | `/api/admin/contracts/[id]` | session | body:updateSchema path:id | updateSalesContract | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/admin/contracts` | session | query:status,agencyId,companyId | listSalesContracts | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/admin/contracts` | session | body:createSchema | createSalesContract | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/admin/guest-dedup/dismiss` | session RESERVATIONS_WRITE | body:schema | dismissDuplicateGroup | jsonOk, handleRouteError | no |
| POST | `/api/admin/guest-dedup/merge` | session RESERVATIONS_WRITE | body:schema | mergeGuestCards | jsonOk, handleRouteError | no |
| GET | `/api/admin/guest-dedup/summary` | session REPORTS_READ | — | getGuestDedupSummary, listDuplicateGroups | jsonOk, handleRouteError | no |
| GET | `/api/admin/links` | session SCREEN_SETTINGS | — | assertPermission, fetchCpChannels, getSatelliteSession, requestOrganizationId | jsonOk, handleRouteError | calls:fetchCpChannels,resolveOperatingMode |
| PATCH | `/api/admin/links` | session SCREEN_SETTINGS | — | assertPermission, getSatelliteSession, patchCpChannel | jsonError, NextResponse.json, jsonOk, handleRouteError | calls:patchCpChannel |
| GET | `/api/admin/maintenance` | session HOUSEKEEPING_MANAGE | — | listMaintenanceWorkOrders | jsonOk, handleRouteError | no |
| POST | `/api/admin/maintenance` | session HOUSEKEEPING_MANAGE | body:createSchema | createMaintenanceWorkOrder | jsonOk, handleRouteError | no |
| GET | `/api/admin/ops-wipe` | see-handler | — | countOpsWipe | jsonOk, handleRouteError | calls:superAdminSession |
| POST | `/api/admin/ops-wipe` | see-handler | body:confirmSchema | countOpsWipe, runOpsWipe | jsonOk, handleRouteError | calls:superAdminSession,recordHotelAudit |
| PATCH | `/api/admin/price-seasons/[id]` | session | body:patchSchema path:id | updatePriceSeason | jsonOk, handleRouteError | no |
| GET | `/api/admin/price-seasons` | session | — | listPriceSeasons | jsonOk, handleRouteError | no |
| GET | `/api/admin/pricing-components/[code]/versions` | session | path:code | getPricingComponent | jsonOk, handleRouteError | no |
| POST | `/api/admin/pricing-components/[code]/versions` | session | body:bodySchema path:code | addPricingComponentVersion | jsonOk, handleRouteError | calls:recordHotelAudit |
| GET | `/api/admin/pricing-components` | session | query:asOf | listPricingComponents, recommendedBoardAddOns | jsonOk, handleRouteError | no |
| GET | `/api/admin/pricing-policy` | session | — | getHotelPolicy | jsonOk, handleRouteError | no |
| PATCH | `/api/admin/pricing-policy` | session | body:patchSchema | getHotelPolicy, updateHotelPolicy | jsonOk, handleRouteError | calls:recordHotelAudit |
| GET | `/api/admin/promotion-codes` | session MASTER_DATA_MANAGE | — | listPromotionCodes | jsonOk, handleRouteError | no |
| POST | `/api/admin/promotion-codes` | session MASTER_DATA_MANAGE | body:schema | createPromotionCode | jsonOk, handleRouteError | no |
| GET | `/api/admin/rate-plans/[id]/sell-versions` | session | path:id | listRatePlanSellVersions | jsonOk, handleRouteError | no |
| POST | `/api/admin/rate-plans/[id]/sell-versions` | session | body:postSchema path:id | addRatePlanSellVersion | jsonOk, handleRouteError | no |
| GET | `/api/admin/report-pack` | session USERS_MANAGE | — | updateHotelProfilePolicyJson | jsonOk, handleRouteError | calls:import,ensureHotelProfile |
| PUT | `/api/admin/report-pack` | session USERS_MANAGE | body:putSchema | updateHotelProfilePolicyJson | jsonOk, handleRouteError | calls:import,ensureHotelProfile |
| POST | `/api/admin/reports/email-cron` | cron-secret? | query:secret | runCronForEachTenant, todayBakuYmd, trySendPlatformNotification | NextResponse.json, jsonOk | calls:runCronForEachTenant,trySendPlatformNotification |
| GET | `/api/admin/roles/[code]/permissions` | session ACCESS_MANAGE | path:code | findHotelRoleByCode | jsonError, jsonOk, handleRouteError | no |
| PATCH | `/api/admin/roles/[code]/permissions` | session ACCESS_MANAGE | body:patchSchema path:code | findHotelRoleByCode, updateHotelRolePermissions | jsonError, NextResponse.json, jsonOk, handleRouteError | calls:recordHotelAudit |
| PATCH | `/api/admin/roles/[code]` | session ACCESS_MANAGE | body:patchSchema path:code | findHotelRoleByCodeWithUserCount, updateHotelRoleName | jsonError, jsonOk, handleRouteError | calls:recordHotelAudit |
| DELETE | `/api/admin/roles/[code]` | session ACCESS_MANAGE | path:code | deleteHotelRole, findHotelRoleByCodeWithUserCount | jsonError, NextResponse.json, jsonOk, handleRouteError | calls:recordHotelAudit |
| GET | `/api/admin/roles` | session ACCESS_MANAGE\|USERS_MANAGE any-of | — | ensureHotelRolesForOrg, listHotelRoles | jsonOk, handleRouteError | no |
| POST | `/api/admin/roles` | session ACCESS_MANAGE | body:createSchema | createHotelRole, ensureHotelRolesForOrg, findHotelRoleByCode | jsonError, jsonOk, handleRouteError | calls:recordHotelAudit |
| POST | `/api/admin/travel-agencies/[id]/portal-invite` | session MASTER_DATA_MANAGE bearer-or-internal | body:inviteSchema,JSON path:id | findAgencyById | jsonError, jsonOk, handleRouteError | calls:requireHotelModule,fetch |
| GET | `/api/admin/travel-agencies` | session MASTER_DATA_MANAGE | — | listTravelAgencies | jsonOk, handleRouteError | no |
| POST | `/api/admin/travel-agencies` | session MASTER_DATA_MANAGE | body:schema | upsertTravelAgency | jsonOk, handleRouteError | no |
| GET | `/api/admin/user-logins` | session USERS_MANAGE | query:q,from,to | listUserLogins | jsonOk, handleRouteError | no |
| PATCH | `/api/admin/users/[id]` | session USERS_MANAGE | body:patchSchema path:id | updateUser | jsonOk, handleRouteError | no |
| GET | `/api/admin/users` | session USERS_MANAGE | — | listUsers | jsonOk, handleRouteError | no |
| POST | `/api/admin/users` | session USERS_MANAGE | body:createSchema | createUser | jsonOk, jsonError, handleRouteError | no |
| PATCH | `/api/admin/yield-rules/[id]` | session MASTER_DATA_MANAGE | body:updateSchema path:id | findYieldRuleById, updateYieldRule | jsonError, jsonOk, handleRouteError | no |
| DELETE | `/api/admin/yield-rules/[id]` | session MASTER_DATA_MANAGE | path:id | deleteYieldRule, findYieldRuleById | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/admin/yield-rules` | session MASTER_DATA_MANAGE | — | listYieldRules | jsonOk, handleRouteError | no |
| POST | `/api/admin/yield-rules` | session MASTER_DATA_MANAGE | body:createSchema | createYieldRule | jsonOk, handleRouteError | no |

## agencies

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/agencies/[id]/city-ledger-snapshot` | session FOLIO_READ | body:JSON path:id | getLastCityLedgerSnapshotAudit | jsonOk, handleRouteError | no |
| POST | `/api/agencies/[id]/city-ledger-snapshot` | session FOLIO_PAYMENT | body:postSchema path:id | assertPermission, dispatchCityLedgerSnapshot, getSatelliteSession, recordHotelAudit | jsonOk, handleRouteError | calls:dispatchCityLedgerSnapshot,recordHotelAudit |
| GET | `/api/agencies/[id]/ledger` | session REPORTS_READ | query:from,to,dispatch path:id | getAgencyLedger | jsonOk, handleRouteError | no |
| GET | `/api/agencies/[id]/settlement` | session FOLIO_READ | path:id | listAgencyTransferredFolios | jsonOk, handleRouteError | no |
| POST | `/api/agencies/[id]/settlement` | session FOLIO_PAYMENT | path:id | assertPermission, getSatelliteSession | handleRouteError | no |
| GET | `/api/agencies` | session REPORTS_READ\|BOOKING_AGENCY_PICK\|SCREEN_DISTRIBUTION any-of | — | listAgencies | jsonOk, handleRouteError | no |

## agency

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/agency/ledger` | see-handler | query:from,to | getAgencyLedger | jsonOk, handleRouteError | calls:requireAgencyPortalSession |
| POST | `/api/agency/reservations/[id]/attachments` | see-handler | query:file,kind body:formData path:id | findAgencyOwnedReservation, uploadReservationAttachmentFile | jsonError, jsonOk, handleRouteError | calls:requireAgencyPortalSession |
| GET | `/api/agency/reservations` | see-handler | — | listAgencyContracts, listAgencyOwnReservations | jsonOk, handleRouteError | calls:requireAgencyPortalSession |
| POST | `/api/agency/reservations` | see-handler | query:action body:quoteSchema,createSchema | agencyQuoteAvailability, createAgencyPortalReservation | jsonOk, handleRouteError | calls:requireAgencyPortalSession |

## auth

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/auth/agency-sso/exchange` | see-handler | body:agencySsoExchangeBodySchema | findActiveAgencyForPortal | jsonError, handleRouteError | calls:requireHotelModule,signAgencySession |
| POST | `/api/auth/login` | see-handler | — | authenticateStaffLogin, completeStaffLoginAfterAuth, recordUserLogin, userPermissions | handleRouteError | calls:signSatelliteSession |
| GET | `/api/auth/login` | see-handler | — | jsonLoginHostBinding | — | no |
| POST | `/api/auth/logout` | see-handler | — | — | — | no |
| GET | `/api/auth/me` | session | — | ensureHotelRolesForOrganization, loadHotelProfileSummary, loadUserWithRole, userPermissions | jsonError, jsonOk, handleRouteError | calls:fetchControlPlaneOrganizationName,canRunHotelImport |
| POST | `/api/auth/session/refresh-permissions` | session | — | loadUserWithRole | jsonError, handleRouteError | calls:signSatelliteSession |
| POST | `/api/auth/sso/exchange` | see-handler | body:ssoExchangeBodySchema | provisionSsoFinanceUser, recordUserLogin, userPermissions | jsonError, handleRouteError | calls:signSatelliteSession |

## banquets

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/banquets/[id]/day-sheet` | session RESERVATIONS_READ | path:id | getBanquetDaySheet | jsonOk, handleRouteError | no |
| GET | `/api/banquets/[id]/lines` | session RESERVATIONS_READ | path:id | listEventOrderLines | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/banquets/[id]/lines` | session RESERVATIONS_WRITE | body:createSchema path:id | addEventOrderLine, assertActiveHotelLookupCode | jsonOk, handleRouteError | calls:requireHotelModule |
| DELETE | `/api/banquets/[id]/lines` | session RESERVATIONS_WRITE | query:lineId path:id | deleteEventOrderLine | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/banquets/[id]/resources` | session RESERVATIONS_WRITE | body:createSchema path:id | addEventResourceBooking | jsonOk, handleRouteError | calls:requireHotelModule |
| DELETE | `/api/banquets/[id]/resources` | session RESERVATIONS_WRITE | query:bookingId path:id | deleteEventResourceBooking | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/banquets/[id]` | session RESERVATIONS_READ | path:id | getBanquetEvent | jsonOk, handleRouteError | no |
| PATCH | `/api/banquets/[id]` | session RESERVATIONS_WRITE | body:patchSchema path:id | confirmBanquetEvent, getBanquetEvent | jsonOk, handleRouteError | no |
| GET | `/api/banquets/[id]/settlement` | session RESERVATIONS_READ | path:id | getEventSettlement | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/banquets/[id]/staff` | session RESERVATIONS_READ | path:id | listEventStaffAssignments | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/banquets/[id]/staff` | session RESERVATIONS_WRITE | body:upsertSchema path:id | upsertEventStaffAssignment | jsonOk, handleRouteError | calls:requireHotelModule |
| DELETE | `/api/banquets/[id]/staff` | session RESERVATIONS_WRITE | query:assignmentId path:id | deleteEventStaffAssignment | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/banquets/calendar` | session RESERVATIONS_READ | query:from,to,saloonId | listEventResourceBookings | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/banquets` | session RESERVATIONS_READ | query:status,from,to | listBanquetEvents, listBanquetMeta | jsonOk, handleRouteError | no |
| POST | `/api/banquets` | session RESERVATIONS_WRITE | body:createSchema | createBanquetEvent | jsonOk, handleRouteError | no |

## bookings

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/bookings/quote` | session RESERVATIONS_READ | query:ratePlanId,checkInDate,checkOutDate,agencyId,roomTypeId body:schema | quoteReservationStay, resolveQuoteRoomTypeId | jsonOk, handleRouteError | no |

## business-date

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/business-date` | session REPORTS_READ | — | getBusinessDateStatus | jsonOk, handleRouteError | no |

## cash

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/cash/shifts` | session CASH_SHIFT | — | listRecentCashShifts | jsonOk, handleRouteError | no |
| POST | `/api/cash/shifts` | session CASH_SHIFT | query:action body:openSchema | closeOpenCashShift, openCashShiftExplicit | jsonOk, handleRouteError | no |

## channel

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/channel/availability` | session CHANNEL_MANAGE | query:from,to | getChannelAvailability | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/channel/binding` | session CHANNEL_MANAGE | — | assertPermission, getChannelManagerBinding, getSatelliteSession, requireHotelModule | jsonOk, handleRouteError | calls:requireHotelModule,getChannelManagerBinding |
| PUT | `/api/channel/binding` | session CHANNEL_MANAGE | body:upsertSchema | assertPermission, getSatelliteSession, isBindingPoolUnavailable, requireHotelModule | jsonOk, jsonError, handleRouteError | calls:requireHotelModule,upsertChannelManagerBinding |
| GET | `/api/channel/errors` | session CHANNEL_MANAGE | — | listSyncErrors | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/channel/errors` | session CHANNEL_MANAGE | body:schema | logSyncError | jsonOk, handleRouteError | calls:requireHotelModule |
| PATCH | `/api/channel/errors` | session CHANNEL_MANAGE | query:id | resolveSyncError | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/channel/health` | session CHANNEL_MANAGE | — | assertPermission, getChannelHealth, getSatelliteSession, requireHotelModule | jsonOk, handleRouteError | calls:requireHotelModule,getChannelHealth |
| GET | `/api/channel/mappings` | session CHANNEL_MANAGE | — | listChannels | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/channel/mappings` | session CHANNEL_MANAGE | body:rateMappingSchema,roomMappingSchema,channelSchema | createChannel, createChannelRateMapping, createChannelRoomMapping | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/channel/ota-cancel` | session CHANNEL_MANAGE | body:schema | handleOtaCancel | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/channel/stop-sell` | session CHANNEL_MANAGE | query:from,to | listStopSells | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/channel/stop-sell` | session CHANNEL_MANAGE | body:createSchema | createStopSell | jsonOk, handleRouteError | calls:requireHotelModule,maybeAutoPushAfterStopSell |
| DELETE | `/api/channel/stop-sell` | session CHANNEL_MANAGE | query:id | removeStopSell | jsonOk, handleRouteError | calls:requireHotelModule,maybeAutoPushAfterStopSell |
| POST | `/api/channel/sync/pull` | session CHANNEL_MANAGE | query:since | assertPermission, getSatelliteSession, pullOtaReservations, requireHotelModule | jsonOk, handleRouteError | calls:requireHotelModule,pullOtaReservations |
| POST | `/api/channel/sync/push` | session CHANNEL_MANAGE | body:request.json | addHotelDays, assertPermission, bakuCivilUtcDate, getSatelliteSession | jsonOk, handleRouteError | calls:requireHotelModule,pushChannelAvailability |

## clinic

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/clinic/capacity` | session | query:date | fetchClinicCapacitySummary, getSatelliteSession | jsonError, NextResponse.json, handleRouteError | calls:fetchClinicCapacitySummary |

## companies

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/companies/[id]/city-ledger-snapshot` | session FOLIO_READ | body:JSON path:id | getLastCityLedgerSnapshotAudit | jsonOk, handleRouteError | no |
| POST | `/api/companies/[id]/city-ledger-snapshot` | session FOLIO_PAYMENT | body:postSchema path:id | assertPermission, dispatchCompanyCityLedgerSnapshot, getSatelliteSession, recordHotelAudit | jsonOk, handleRouteError | calls:dispatchCompanyCityLedgerSnapshot,recordHotelAudit |
| GET | `/api/companies/[id]/ledger` | session REPORTS_READ | query:from,to path:id | getCompanyLedger | jsonOk, handleRouteError | no |
| GET | `/api/companies/[id]/settlement` | session FOLIO_READ | path:id | listCompanyTransferredFolios | jsonOk, handleRouteError | no |
| POST | `/api/companies/[id]/settlement` | session FOLIO_PAYMENT | path:id | assertPermission, getSatelliteSession | handleRouteError | no |
| GET | `/api/companies` | session REPORTS_READ\|BOOKING_COMPANY_PICK any-of | — | listCompanies | jsonOk, handleRouteError | no |

## concierge

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/concierge` | session RESERVATIONS_READ | query:guestId,view | listConciergeOrders, listConciergeProducts | jsonOk, handleRouteError | no |
| POST | `/api/concierge` | session RESERVATIONS_WRITE | body:createProductSchema,bookSchema | assertActiveHotelLookupCode, bookConciergeOrder, completeConciergeOrder, createConciergeProduct | jsonOk, handleRouteError | no |

## counterparties

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/counterparties/voen-preview` | session | — | fetchVoenPreviewFromRequest, getSatelliteSession | jsonError, jsonOk, handleRouteError | calls:fetchVoenPreviewFromRequest |

## cron

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/cron/allotment-block-cutoff` | cron-secret? | query:authorization | releaseAllotmentBlocksPastCutoff | jsonOk, handleRouteError | calls:runCronForEachTenant |
| POST | `/api/cron/auto-bar` | cron-secret? | query:authorization | applyAutoBar | jsonOk, handleRouteError | calls:runCronForEachTenant |
| POST | `/api/cron/channel-ari-drain` | cron-secret? | query:authorization | drainAriQueueForOrg, runCronForEachTenant | jsonOk, handleRouteError | calls:runCronForEachTenant,drainAriQueueForOrg |

## dispatch

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/dispatch` | session RESERVATIONS_READ | — | listDispatchRequests, listDispatchVehicles | jsonOk, handleRouteError | no |
| POST | `/api/dispatch` | session RESERVATIONS_WRITE | body:createSchema | assignDispatchRequest, completeDispatchRequest, createDispatchRequest | jsonOk, handleRouteError | no |

## distribution

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/distribution/agency-commission/batches/[id]/pay` | session FOLIO_PAYMENT | path:id | refuseHotelCommissionPay | handleRouteError | no |
| POST | `/api/distribution/agency-commission/batches/[id]/submit` | session MASTER_DATA_MANAGE | path:id | submitCommissionBatch | jsonOk, handleRouteError | no |
| POST | `/api/distribution/agency-commission/batches` | session MASTER_DATA_MANAGE | body:schema | createCommissionBatch | jsonOk, handleRouteError | no |
| GET | `/api/distribution/agency-commission/forecast` | session REPORTS_READ\|SCREEN_DISTRIBUTION any-of | query:from,to | forecastAgencyCommission | jsonOk, handleRouteError | no |
| POST | `/api/distribution/agency-commission/lines/[id]/dispute` | session MASTER_DATA_MANAGE | body:schema path:id | disputeCommissionLine | jsonOk, handleRouteError | no |
| POST | `/api/distribution/agency-commission/lines/[id]/hold` | session MASTER_DATA_MANAGE | body:schema path:id | holdCommissionLine, releaseCommissionHold | jsonOk, handleRouteError | no |
| GET | `/api/distribution/agency-commission/lines` | session REPORTS_READ\|SCREEN_DISTRIBUTION any-of | query:from,to,agencyId,status | listCommissionLines | jsonOk, handleRouteError | no |
| POST | `/api/distribution/agency-commission/lines` | session MASTER_DATA_MANAGE | body:readySchema | markLinesReady | jsonOk, handleRouteError | no |
| POST | `/api/distribution/agency-commission/rebuild` | session MASTER_DATA_MANAGE | body:schema | rebuildCheckedOutForOrg, rebuildStay | jsonOk, handleRouteError | no |
| GET | `/api/distribution/agency-commission/summary` | session REPORTS_READ\|SCREEN_DISTRIBUTION any-of | query:from,to | listCommissionSummary | jsonOk, handleRouteError | no |

## duty-schedules

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/duty-schedules/[dept]/axes` | session DUTY_SCHEDULES_MANAGE | path:dept | assertPermission, getSatelliteSession, listAxes, parseDeptParam | jsonOk, handleRouteError | calls:listAxes |
| POST | `/api/duty-schedules/[dept]/axes` | session DUTY_SCHEDULES_MANAGE | body:bodySchema path:dept | assertPermission, getSatelliteSession, parseDeptParam, upsertAxis | jsonOk, handleRouteError | calls:upsertAxis |
| GET | `/api/duty-schedules/[dept]/binding` | session DUTY_SCHEDULES_MANAGE | path:dept | assertPermission, getBinding, getSatelliteSession, parseDeptParam | jsonOk, handleRouteError | calls:getBinding |
| PUT | `/api/duty-schedules/[dept]/binding` | session DUTY_SCHEDULES_MANAGE | body:bodySchema path:dept | assertPermission, getSatelliteSession, parseDeptParam, upsertBinding | jsonOk, handleRouteError | calls:upsertBinding |
| GET | `/api/duty-schedules/[dept]/personnel` | session DUTY_SCHEDULES_MANAGE | path:dept | assertPermission, getSatelliteSession, listPersonnel, parseDeptParam | jsonOk, handleRouteError | calls:listPersonnel |
| GET | `/api/duty-schedules/[dept]/week` | session DUTY_SCHEDULES_MANAGE | query:weekStart path:dept | assertPermission, getOrCreateWeek, getSatelliteSession, parseDeptParam | jsonOk, handleRouteError | calls:getOrCreateWeek |
| POST | `/api/duty-schedules/[dept]/week` | session DUTY_SCHEDULES_MANAGE | body:deleteSchema,statusSchema,copySchema,upsertSchema path:dept | assertPermission, copyPreviousWeek, deleteCell, getSatelliteSession | jsonOk, handleRouteError | calls:deleteCell,setWeekStatus,copyPreviousWeek,upsertCell |
| GET | `/api/duty-schedules/catalog` | session DUTY_SCHEDULES_MANAGE | — | assertPermission, getSatelliteSession, listCatalog | jsonOk, handleRouteError | calls:listCatalog |

## executive

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/executive/dashboard` | session REPORTS_READ\|RESERVATIONS_READ any-of | query:date | getExecutiveDashboard | jsonOk, handleRouteError | no |
| GET | `/api/executive/forecast` | session REPORTS_READ\|RESERVATIONS_READ any-of | body:querySchema | getOccupancyForecast | jsonOk, handleRouteError | no |
| GET | `/api/executive/unit-economics` | session MASTER_DATA_MANAGE\|RESERVATIONS_READ any-of | — | getUnitEconomicsSnapshot | jsonOk, handleRouteError | no |

## fiscal

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/fiscal/devices` | session | query:outlet,register,kind | getSatelliteSession | jsonError, NextResponse.json, handleRouteError | calls:import,ensureFiscalDevices |

## fleet

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/fleet/vehicles/[id]` | session RESERVATIONS_WRITE | body:patchSchema path:id | updateFleetVehicle | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/fleet/vehicles` | session RESERVATIONS_WRITE | — | listFleetVehicles | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/fleet/vehicles` | session RESERVATIONS_WRITE | body:bodySchema | createFleetVehicle | jsonOk, handleRouteError | calls:requireHotelModule |

## fo

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/fo/agency-inbox` | session RESERVATIONS_READ | — | listAgencyInbox | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/fo/agency-inbox` | session RESERVATIONS_WRITE | body:actionSchema | confirmAgencyInboxItem, declineAgencyInboxItem | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/fo/quick-profile` | session RESERVATIONS_WRITE | body:schema | createQuickAgency, createQuickCompany | jsonOk, handleRouteError | no |
| GET | `/api/fo/room-type-availability` | session RESERVATIONS_READ | query:from,to | getRoomTypeAvailabilityMatrix | jsonOk, handleRouteError | no |
| GET | `/api/fo/sellable` | session RESERVATIONS_READ | query:roomTypeId,from,to,salesContractId | getAvailabilityWithContractAllotment, getSellablePreview | jsonOk, handleRouteError | no |
| GET | `/api/fo/share-rooming-queue` | session RESERVATIONS_READ | query:roomTypeId,gender,limit | listShareRoomingQueue | jsonOk, handleRouteError | no |
| GET | `/api/fo/share-rooming-suggestions` | session RESERVATIONS_READ | query:reservationId,limit body:querySchema | suggestShareDoors | jsonOk, handleRouteError | no |
| GET | `/api/fo/status-dashboard` | session REPORTS_READ\|RESERVATIONS_READ any-of | query:date,waiting,revenue | getFoStatusDashboard | jsonOk, handleRouteError | no |

## folios

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/folios/[id]/close` | session FOLIO_PAYMENT | path:id | closeFolio | jsonOk, handleRouteError | no |
| POST | `/api/folios/[id]/issue-invoice` | session FOLIO_PAYMENT | path:id | issueFolioInvoice | jsonOk, handleRouteError | no |
| POST | `/api/folios/[id]/retry-cl-invoice` | session FOLIO_PAYMENT | path:id | getFolioCityLedgerRetryMeta, handoffPendingCityLedger | jsonOk, handleRouteError | no |
| POST | `/api/folios/category-refund` | session FOLIO_PAYMENT | body:schema | assertPermission, getSatelliteSession | jsonOk, handleRouteError | calls:import,refundStayCategoryCredit |
| POST | `/api/folios/charges/[chargeId]/adjust` | session FOLIO_CHARGE | body:bodySchema path:chargeId | postFolioAdjustment | jsonOk, handleRouteError | no |
| POST | `/api/folios/charges/[chargeId]/pay` | session FOLIO_PAYMENT | body:bodySchema path:chargeId | payFolioCharge | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/folios/charges/[chargeId]/transfer` | session FOLIO_CHARGE | body:bodySchema path:chargeId | transferFolioCharge | jsonOk, handleRouteError | no |
| POST | `/api/folios/charges/[chargeId]/void` | session FOLIO_VOID | body:bodySchema path:chargeId | voidCharge | jsonOk, handleRouteError | no |
| POST | `/api/folios/deposits/transfer` | session FOLIO_PAYMENT | body:bodySchema | transferDeposit | jsonOk, handleRouteError | no |
| GET | `/api/folios/pay-targets` | session FOLIO_PAYMENT | query:q | listCashierPayTargets | jsonOk, handleRouteError | no |
| POST | `/api/folios/payments/[id]/refund` | session FOLIO_PAYMENT | body:schema path:id | refundFolioPayment | jsonOk, handleRouteError | no |
| POST | `/api/folios/payments/[id]/transfer` | session FOLIO_PAYMENT | body:bodySchema path:id | transferFolioPayment | jsonOk, handleRouteError | no |
| POST | `/api/folios/payments/[id]/void` | session FOLIO_VOID | body:bodySchema path:id | voidFolioPayment | jsonOk, handleRouteError | no |
| GET | `/api/folios` | session FOLIO_READ | query:reservationId | listFolios | jsonOk, handleRouteError | no |
| POST | `/api/folios` | session FOLIO_PAYMENT\|FOLIO_CHARGE | body:paymentSchema,chargeSchema | postCharge, postPayment | jsonOk, handleRouteError | calls:import,postStayCategoryPayment,postStayArticlePayment |
| GET | `/api/folios/settle` | session FOLIO_READ | query:folioId | getFolioSettlementPreview | jsonOk, handleRouteError | no |
| POST | `/api/folios/settle` | session FOLIO_PAYMENT | body:settleSchema | settleFolio | jsonOk, handleRouteError | no |

## front-cash

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/front-cash/desk` | session FOLIO_READ | query:date | getCurrentBusinessDate, listCashDesk | jsonOk, handleRouteError | no |
| POST | `/api/front-cash/desk` | session CASH_SHIFT | body:closeSchema | closeCashDeskRow, listCashDesk | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/folio-balances` | session FOLIO_READ | query:tab,q,dateFrom,dateTo | listReservationFolioBalances | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/folio-journal` | session FOLIO_READ | query:from,to | getCurrentBusinessDate, queryFolioTransactions | jsonOk, handleRouteError | no |
| POST | `/api/front-cash/guest-debt/[id]/pay` | session FOLIO_PAYMENT | body:schema path:id | payGuestDebt | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/guest-debt` | session FOLIO_READ | — | listGuestDebtJournal | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/journal` | session FOLIO_READ | query:date,from,cashPoint,tender | getCurrentBusinessDate, listCashJournal | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/transactions` | session FOLIO_READ | query:from,to,cashShiftId | getCurrentBusinessDate, listFrontCashJournal | jsonOk, handleRouteError | no |
| GET | `/api/front-cash/unsettled-departures` | session FOLIO_READ | body:querySchema | listUnsettledDepartures | jsonOk, handleRouteError | no |

## fx-preview

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/fx-preview` | session | query:from,amount,to,date,authorization body:querySchema | financeFxPreview, getSatelliteSession | jsonError, jsonOk, handleRouteError | calls:financeFxPreview |

## guests

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/guests/[id]/accompanying` | session RESERVATIONS_READ | path:id | listAccompanyingGuests | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/addresses` | session RESERVATIONS_READ | path:id | listGuestAddresses | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/addresses` | session RESERVATIONS_WRITE | body:schema path:id | createGuestAddress | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/allergens` | session RESERVATIONS_READ | path:id | listGuestAllergens | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/allergens` | session RESERVATIONS_WRITE | body:schema path:id | createGuestAllergen | jsonOk, handleRouteError | no |
| DELETE | `/api/guests/[id]/allergens` | session RESERVATIONS_WRITE | query:id path:id | deleteGuestAllergen | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/archive` | session RESERVATIONS_READ | path:id | listGuestArchiveFiles | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/archive` | session RESERVATIONS_WRITE | body:schema path:id | createGuestArchiveFile | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/booker-history` | session RESERVATIONS_READ | path:id | listBookerHistory | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/comments` | session RESERVATIONS_READ | path:id | listGuestComments | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/comments` | session RESERVATIONS_WRITE | body:schema path:id | createGuestComment | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/communications` | session RESERVATIONS_READ | query:channel path:id | listGuestCommunications | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/communications` | session RESERVATIONS_WRITE | body:schema path:id | createGuestCommunication | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/contact-logs` | session RESERVATIONS_READ | path:id | listGuestContactLogs | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/contacts` | session RESERVATIONS_READ | path:id | listGuestContacts | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/contacts` | session RESERVATIONS_WRITE | body:schema path:id | createGuestContact | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/crm-badges` | session RESERVATIONS_READ | path:id | getGuestCrmBadges | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/crm-extension` | session RESERVATIONS_READ | path:id | getGuestCrmExtension | jsonOk, handleRouteError | no |
| PATCH | `/api/guests/[id]/crm-extension` | session RESERVATIONS_WRITE | body:patchSchema path:id | getGuestCrmExtension, upsertGuestCrmExtension | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/documents` | session RESERVATIONS_READ | path:id | listGuestDocuments | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/documents` | session RESERVATIONS_WRITE | body:schema path:id | createGuestDocument | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/family` | session RESERVATIONS_READ | path:id | listGuestFamily | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/family` | session RESERVATIONS_WRITE | body:schema path:id | createGuestFamily | jsonOk, handleRouteError | no |
| DELETE | `/api/guests/[id]/family` | session RESERVATIONS_WRITE | query:id path:id | deleteGuestFamily | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/favorites` | session RESERVATIONS_READ | path:id | listGuestFavoriteRooms | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/favorites` | session RESERVATIONS_WRITE | body:schema path:id | createGuestFavoriteRoom | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/full` | session RESERVATIONS_READ | path:id | getGuestFull | jsonOk, handleRouteError | no |
| PATCH | `/api/guests/[id]/full` | session RESERVATIONS_WRITE | body:patchSchema path:id | patchGuestFull | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/incidents` | session RESERVATIONS_READ | path:id | listGuestIncidents | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/incidents` | session RESERVATIONS_WRITE | body:schema path:id | createGuestIncident | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/loyalty-cards` | session RESERVATIONS_READ | path:id | listGuestLoyaltyCards | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/loyalty-cards` | session RESERVATIONS_WRITE | body:schema path:id | createGuestLoyaltyCard | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/loyalty/points` | session RESERVATIONS_READ | path:id | listGuestLoyaltyPoints | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/loyalty/points` | session RESERVATIONS_WRITE | body:postSchema path:id | createGuestLoyaltyPoint | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/loyalty` | session RESERVATIONS_READ | path:id | getGuestLoyalty | jsonOk, handleRouteError | no |
| PATCH | `/api/guests/[id]/loyalty` | session RESERVATIONS_WRITE | body:patchSchema path:id | setGuestLoyaltyTier | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/notes` | session RESERVATIONS_READ | path:id | listGuestNotes | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/notes` | session RESERVATIONS_WRITE | body:schema path:id | createGuestNote | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/preferences` | session RESERVATIONS_READ | path:id | listGuestPreferences | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/preferences` | session RESERVATIONS_WRITE | body:schema path:id | createGuestPreference | jsonOk, handleRouteError | no |
| DELETE | `/api/guests/[id]/preferences` | session RESERVATIONS_WRITE | query:id path:id | deleteGuestPreference | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/reclaims` | session RESERVATIONS_READ | path:id | listGuestComments | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/reclaims` | session RESERVATIONS_WRITE | body:schema path:id | createGuestComment | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/reservation-analytics` | session RESERVATIONS_READ | path:id | getGuestReservationAnalytics | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/special-dates` | session RESERVATIONS_READ | path:id | listGuestSpecialDates | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/special-dates` | session RESERVATIONS_WRITE | body:schema path:id | createGuestSpecialDate | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/special-notes` | session RESERVATIONS_READ | path:id | listSpecialGuestNotes | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/special-notes` | session RESERVATIONS_WRITE | body:schema path:id | createGuestNote | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/stats` | session RESERVATIONS_READ | path:id | getGuestStats | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/surveys` | session RESERVATIONS_READ | path:id | listGuestSurveys | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/surveys` | session RESERVATIONS_WRITE | body:schema path:id | createGuestSurvey | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/tags` | session RESERVATIONS_READ | path:id | listGuestTags | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/tags` | session RESERVATIONS_WRITE | body:schema path:id | createGuestTag | jsonOk, handleRouteError | no |
| DELETE | `/api/guests/[id]/tags` | session RESERVATIONS_WRITE | query:tagId path:id | deleteGuestTag | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/tasks` | session RESERVATIONS_READ | path:id | listGuestTasks | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/tasks` | session RESERVATIONS_WRITE | body:schema path:id | createGuestTask | jsonOk, handleRouteError | no |
| GET | `/api/guests/[id]/time-shares` | session RESERVATIONS_READ | path:id | listGuestTimeShares | jsonOk, handleRouteError | no |
| POST | `/api/guests/[id]/time-shares` | session RESERVATIONS_WRITE | body:schema path:id | createGuestTimeShare | jsonOk, handleRouteError | no |
| POST | `/api/guests/mrz-match` | session | body:schema | getSatelliteSession, isPlatformSuperAdminUser, matchMrzGuest, parseMrz | jsonOk, handleRouteError | calls:matchMrzGuest |
| GET | `/api/guests` | session RESERVATIONS_READ | query:q,page,pageSize,gender,nationality,fin,passport,birthDateFrom,birthDateTo,email,phone,externalRef | listGuests | jsonOk, handleRouteError | no |
| POST | `/api/guests` | session RESERVATIONS_WRITE | body:createGuestSchema | createGuest | jsonOk, handleRouteError | no |

## health

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/health` | see-handler | — | — | NextResponse.json | no |

## hotel

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/hotel/integration-settings` | session MASTER_DATA_MANAGE | — | assertPermission, getOutboundSettings, getSatelliteSession, getSubscriptionMe | jsonOk, handleRouteError | calls:getOutboundSettings,getSubscriptionMe |
| PATCH | `/api/hotel/integration-settings` | session MASTER_DATA_MANAGE | body:patchSchema | assertPermission, createCustomDomain, getOutboundSettings, getSatelliteSession | jsonOk, handleRouteError | calls:getOutboundSettings,saveIntegrationSettings,createCustomDomain |
| PUT | `/api/hotel/integration-settings` | session MASTER_DATA_MANAGE | body:patchSchema | assertPermission, getOutboundSettings, getSatelliteSession, saveIntegrationSettings | jsonOk, handleRouteError | calls:getOutboundSettings,saveIntegrationSettings |
| GET | `/api/hotel/profile/logo` | session MASTER_DATA_MANAGE\|REPORTS_READ\|RESERVATIONS_READ any-of | — | readHotelLogo | jsonError, handleRouteError, NextResponse(body) | no |
| POST | `/api/hotel/profile/logo` | session MASTER_DATA_MANAGE | query:file body:formData | resolveCpLetterheadLocks, saveHotelLogo | jsonError, jsonOk, handleRouteError | no |
| DELETE | `/api/hotel/profile/logo` | session MASTER_DATA_MANAGE | — | deleteHotelLogo, resolveCpLetterheadLocks | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/hotel/profile` | session RESERVATIONS_READ\|MASTER_DATA_MANAGE\|REPORTS_READ any-of | — | getHotelProfile, resolveCpLetterheadLocks | jsonOk, handleRouteError | no |
| PUT | `/api/hotel/profile` | session MASTER_DATA_MANAGE | body:schema | resolveCpLetterheadLocks, upsertHotelProfile | jsonOk, handleRouteError | no |

## housekeeping

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/housekeeping/closed-rooms/[id]/return` | session HOUSEKEEPING_MANAGE | path:id | returnRoomToService | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/closed-rooms` | session ROOMS_STATUS\|HOUSEKEEPING_MANAGE any-of | — | listClosedRooms | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/condition` | session HOUSEKEEPING_MANAGE\|ROOMS_STATUS any-of | body:schema | setHousekeepingCondition | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/consumption/[id]/reverse` | session HOUSEKEEPING_MANAGE | path:id | reverseHkConsumption | jsonOk, handleRouteError | no |
| DELETE | `/api/housekeeping/consumption/[id]` | session HOUSEKEEPING_MANAGE | path:id | deleteHkConsumption | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/consumption` | session HOUSEKEEPING_MANAGE | — | listHkConsumption | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/consumption` | session HOUSEKEEPING_MANAGE | body:bodySchema | saveHkConsumption | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/discrepancy` | session HOUSEKEEPING_MANAGE | query:date | escalateVisitFlags, listDiscrepanciesWithRooms | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/discrepancy` | session HOUSEKEEPING_MANAGE | body:schema | clearDiscrepancyForRoom, recordDiscrepancy | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/eg` | session HOUSEKEEPING_MANAGE | — | listHousekeeperEgBalances | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/eg` | session HOUSEKEEPING_MANAGE | body:request.json | accrueEgForDate, burnEgBalances | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/finance-products` | session HOUSEKEEPING_MANAGE | query:q,includeServices,limit | assertPermission, getSatelliteSession, requestOrganizationId, searchFinanceCatalog | jsonOk, handleRouteError | calls:searchFinanceCatalog |
| GET | `/api/housekeeping/forecast` | session HOUSEKEEPING_MANAGE | query:days,from | hkLoadForecast | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/laundry/catalog` | session HOUSEKEEPING_MANAGE | — | ensureNaftaLaundryCatalog, listLaundryCatalogItems | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/laundry/catalog` | session HOUSEKEEPING_MANAGE | body:itemBody | createLaundryCatalogItem | jsonOk, handleRouteError | no |
| PATCH | `/api/housekeeping/laundry/catalog` | session HOUSEKEEPING_MANAGE | body:patchBody | findLaundryCatalogItem, updateLaundryCatalogItem | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/laundry` | session any-of | query:reservationId | listLaundryWorkspace | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/laundry` | session HOUSEKEEPING_MANAGE any-of | body:voidBody,deliverBody,createTicket | createLaundryTicket, deliverLaundryTicket | jsonOk, handleRouteError | calls:import,voidOpenLaundryTicket |
| GET | `/api/housekeeping/lost-found` | session HOUSEKEEPING_MANAGE | query:guestId | listLostFound | jsonOk, handleRouteError | no |
| PATCH | `/api/housekeeping/lost-found` | session HOUSEKEEPING_MANAGE | body:statusSchema | updateLostFoundStatus | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/lost-found` | session HOUSEKEEPING_MANAGE | body:schema | createLostFound | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/maids` | session HOUSEKEEPING_MANAGE | — | listHousekeepers | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/maids` | session HOUSEKEEPING_MANAGE | body:assignSchema,patchSchema,createSchema | assignTaskHousekeeper, createHousekeeper, deactivateHousekeeper, updateHousekeeperDepartment | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/minibar` | session HOUSEKEEPING_MANAGE | — | listMinibarItems, listMinibarOpsBoard | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/minibar` | session HOUSEKEEPING_MANAGE | body:itemSchema,postSchema | createMinibarCatalogItem, postMinibar | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/needed-by` | session HOUSEKEEPING_MANAGE | body:schema | setNeededByAt | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/nsr` | session HOUSEKEEPING_MANAGE | body:schema | postNsrDay | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/outcome` | session HOUSEKEEPING_MANAGE | body:schema | applySheetOutcome, applyVisitOutcome, clearSheetOutcome | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/personnel` | session HOUSEKEEPING_MANAGE | — | assertPermission, fetchWorkforcePicker, getSatelliteSession, requestOrganizationId | jsonOk, handleRouteError | calls:fetchWorkforcePicker |
| GET | `/api/housekeeping/policy` | session HOUSEKEEPING_MANAGE | — | getHkHotelPolicy | jsonOk, handleRouteError | no |
| PUT | `/api/housekeeping/policy` | session HOUSEKEEPING_MANAGE | body:schema | saveHkHotelPolicy | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/roster` | session HOUSEKEEPING_MANAGE | query:weekStart | getRosterWeekByStart, listHousekeepersForRoster | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/roster` | session HOUSEKEEPING_MANAGE | body:cell,propose | moveHousekeeperDepartment, proposeRosterWeek, reorderHousekeepers, setRosterCell | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/rotation` | session HOUSEKEEPING_MANAGE | query:date | ensureFloorPairs, listHkRotationDay | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/rotation` | session HOUSEKEEPING_MANAGE | body:schema | rotatePairsForDate, swapRotationPairs | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/sheet` | session HOUSEKEEPING_MANAGE | query:date,format,lang,floor,all | generateAllFloorSheets, generateFloorSheet, generateFloorSheetPdf | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/stay-linen` | session HOUSEKEEPING_MANAGE | body:bodySchema | saveStayLinenOverride | jsonOk, handleRouteError | no |
| GET | `/api/housekeeping/tasks` | session HOUSEKEEPING_MANAGE | — | listTasks | jsonOk, handleRouteError | no |
| POST | `/api/housekeeping/tasks` | session HOUSEKEEPING_MANAGE | body:oooSchema,completeSchema | completeTask, setRoomOOO, setRoomOOS | jsonOk, handleRouteError | no |

## import

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/import/[entity]` | see-handler | query:dryRun,content-type body:request.json body:formData path:entity | assertHotelImportAccess, getImportAdapter, recordHotelAudit, runFilelessImport | jsonError, jsonOk, handleRouteError | calls:assertHotelImportAccess,runFilelessImport,recordHotelAudit,runImportBuffers,runImport |
| GET | `/api/import` | see-handler | — | assertHotelImportAccess, listImportEntities | jsonOk, handleRouteError | calls:assertHotelImportAccess |

## integration

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/integration/erp/inbound` | see-handler | body:e6Schema | applyE6FiscalStatusChanged | jsonOk, handleRouteError | no |
| POST | `/api/integration/erp/simulate` | session MASTER_DATA_MANAGE | body:schema | applyE6FiscalStatusChanged | jsonOk, handleRouteError | no |
| POST | `/api/integration/gl-status` | bearer-or-internal | query:authorization body:bodySchema | applyFiscalGlPostedStatus | jsonOk, handleRouteError | no |
| POST | `/api/integration/master-data-sync` | session MASTER_DATA_MANAGE | — | assertPermission, dispatchMasterDataSync, getSatelliteSession | jsonOk, handleRouteError | calls:dispatchMasterDataSync |
| POST | `/api/integration/mock-licensing` | see-handler | body:request.json | countActiveNonCrossSystemUsers | jsonOk | no |
| POST | `/api/integration/mock-receiver` | see-handler | body:request.json | — | jsonOk | no |
| GET | `/api/integration/outbound-log` | session MASTER_DATA_MANAGE | query:limit,status | assertPermission, getSatelliteSession, listOutboundEventLog | jsonOk, handleRouteError | calls:listOutboundEventLog |
| POST | `/api/integration/retry` | session NIGHT_AUDIT_RUN | — | assertPermission, getSatelliteSession, processRetryQueue | jsonOk, handleRouteError | calls:processRetryQueue |
| POST | `/api/integration/staff-provision` | see-handler | query:x-satellite-bridge-secret body:request.json | enterRequestTenant, handleStaffProvisionEvent | NextResponse.json, jsonOk | calls:handleStaffProvisionEvent |

## integrations

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/integrations/channex/webhook` | see-handler | query:x-channex-webhook-secret,x-era-ota-secret body:bodySchema | logSyncError | jsonOk, handleRouteError | calls:getChannelManagerBindingByPropertyId,loadChannexClient,fetchBookingRevision,upsertOtaReservation,ackBookingRevision |
| POST | `/api/integrations/door-lock/unlock` | session | body:bodySchema | getDoorLockAdapter, getSatelliteSession | jsonError, jsonOk, handleRouteError | calls:getDoorLockAdapter |
| GET | `/api/integrations/elektraweb-bridge/health` | see-handler | query:authorization | authenticateBridgeRequest, countOutboxByStatus, getBridgeHealth, getElektrawebBridgePolicy | jsonOk, handleRouteError | calls:authenticateBridgeRequest,getElektrawebBridgePolicy,countOutboxByStatus |
| POST | `/api/integrations/elektraweb-bridge/login` | see-handler | — | authenticateElektrawebBridgeStaff, effectiveRolePermissions, enterBridgeTenant, getElektrawebBridgePolicy | jsonError, jsonOk, handleRouteError | calls:authenticateElektrawebBridgeStaff,loadActiveUserWithRole,getElektrawebBridgePolicy,signBridgeToken |
| POST | `/api/integrations/elektraweb-bridge/outbox/[id]/ack` | see-handler | body:schema path:id | ackElektrawebOutbox, authenticateBridgeRequest | jsonOk, handleRouteError | calls:authenticateBridgeRequest,ackElektrawebOutbox |
| GET | `/api/integrations/elektraweb-bridge/outbox` | see-handler | — | authenticateBridgeRequest, claimPendingOutbox, getElektrawebBridgePolicy, isPolicyWriteEnabled | jsonOk, handleRouteError | calls:authenticateBridgeRequest,getElektrawebBridgePolicy,claimPendingOutbox |
| POST | `/api/integrations/elektraweb-bridge/outbox` | see-handler | body:enqueueSchema | authenticateBridgeRequest, enqueueElektrawebOutbox, enterSatelliteTenant, verifyPosBridge | jsonOk, handleRouteError | calls:authenticateBridgeRequest,enqueueElektrawebOutbox |
| POST | `/api/integrations/elektraweb-bridge` | see-handler | body:batchSchema,bridgeEnvelopeSchema | authenticateBridgeRequest, ingestElektrawebBridgeEnvelope | jsonOk, jsonError, handleRouteError | calls:authenticateBridgeRequest,ingestElektrawebBridgeEnvelope |
| POST | `/api/integrations/minibar-sensor` | see-handler | body:schema | ingestMinibarSensorEvent | jsonOk, handleRouteError | no |
| POST | `/api/integrations/ota/[channel]` | see-handler | query:x-era-ota-secret body:bodySchema path:channel | logSyncError | jsonOk, handleRouteError | calls:resolveChannelAdapter,upsertOtaReservation |

## internal

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/internal/v1/agency-commission/commission-offset-applied` | bearer-or-internal | query:authorization body:bodySchema | applyCommissionOffset | jsonOk, handleRouteError | no |
| POST | `/api/internal/v1/agency-commission/commission-paid` | bearer-or-internal | query:authorization body:bodySchema | applyCommissionPaid, findAgencyCommissionBatchById | jsonOk, handleRouteError | no |
| POST | `/api/internal/v1/city-ledger/payment-applied` | bearer-or-internal | query:authorization body:bodySchema | applyCityLedgerPaymentFromFinance | jsonOk, handleRouteError | no |
| POST | `/api/internal/v1/consumption` | bearer-or-internal | query:authorization,x-service-token body:bodySchema | recordInternalConsumption | jsonOk | no |
| POST | `/api/internal/v1/folio-charges/received` | see-handler | body:bodySchema | markFolioChargeServiceReceived | NextResponse.json, jsonOk | no |
| GET | `/api/internal/v1/guests/by-identity` | bearer-or-internal | query:authorization,x-service-token,organizationId,fullName,birthDate,phone | lookupGuestGlobalPersonByIdentity | jsonOk, handleRouteError | no |
| POST | `/api/internal/v1/placement/export-slice` | see-handler | body:bodySchema | exportHotelOrgSlice, hotelSliceMetaSummary | jsonOk, handleRouteError | calls:exportHotelOrgSlice |
| POST | `/api/internal/v1/placement/import-slice` | see-handler | body:bodySchema | importHotelOrgSlice | jsonOk, handleRouteError | calls:importHotelOrgSlice |
| GET/POST | `/api/internal/v1/placement/preflight` | see-handler | Bearer | computePrismaMigrationHash | jsonOk | migrationHash + freeBytes hint |
| POST | `/api/internal/v1/reservations/checked-out` | see-handler | body:bodySchema | listCheckedOutReservationIds | NextResponse.json, jsonOk | no |
| POST | `/api/internal/v1/reservations/clinic-sync` | see-handler | body:bodySchema | listClinicSyncSnapshot | NextResponse.json, jsonOk | no |
| GET | `/api/internal/v1/revenue-codes` | bearer-or-internal | query:authorization,x-service-token,organizationId | listActiveRevenueCodeSummaries | — | no |
| GET | `/api/internal/v1/stays/by-external-ref` | bearer-or-internal | query:authorization,x-service-token,externalRef,organizationId,folioPerson | findStayByExternalRef, pickStayGlobalPersonId | jsonOk, handleRouteError | no |
| GET | `/api/internal/v1/workforce/roles` | see-handler | query:x-satellite-bridge-secret,organizationId | listWorkforceRolesForBridge | NextResponse.json | no |

## locale

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/locale` | see-handler | body:schema | eraLocaleCookieOptions, isLocale | NextResponse.json | no |

## loyalty

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/loyalty/balance` | session FOLIO_READ bearer-or-internal | query:customerRef | assertPermission, getSatelliteSession, requestOrganizationId | jsonOk, handleRouteError | calls:fetch |

## master

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/master/bar-rates/[id]` | session | body:schema path:id | patchBarRate | jsonOk, handleRouteError | no |
| GET | `/api/master/bar-rates` | session | query:from,to,ratePlanId,roomTypeId | listBarRates | jsonOk, handleRouteError | no |
| POST | `/api/master/bar-rates` | session | body:bulkSchema | bulkUpsertBarRates | jsonOk, handleRouteError | no |
| PATCH | `/api/master/bed-types/[id]` | session | body:schema path:id | updateBedType | jsonOk, handleRouteError | no |
| GET | `/api/master/bed-types` | session | — | listBedTypes | jsonOk, handleRouteError | no |
| POST | `/api/master/bed-types` | session | body:schema | createBedType | jsonOk, handleRouteError | no |
| GET | `/api/master/booking-sources` | session RESERVATIONS_READ | — | listBookingSources | jsonOk, handleRouteError | no |
| PATCH | `/api/master/departments/[id]` | session | body:schema path:id | updateDepartment | jsonOk, handleRouteError | no |
| GET | `/api/master/departments` | session | — | listDepartments | jsonOk, handleRouteError | no |
| POST | `/api/master/departments` | session | body:schema | createDepartment | jsonOk, handleRouteError | no |
| GET | `/api/master/inventory-caps` | session | — | getInventoryCaps | jsonOk, handleRouteError | no |
| PATCH | `/api/master/inventory-caps` | session | body:schema | getInventoryCaps, updateHouseOverbook | jsonOk, handleRouteError | no |
| PATCH | `/api/master/lookups/[id]` | session | body:schema path:id | updateHotelLookup | jsonOk, handleRouteError | no |
| GET | `/api/master/lookups` | session | query:kind,activeOnly body:kindSchema | listHotelLookups | jsonOk, handleRouteError | no |
| POST | `/api/master/lookups` | session | body:createSchema | createHotelLookup | jsonOk, handleRouteError | no |
| GET | `/api/master/meal-plans` | session RESERVATIONS_READ | — | listMealPlans, listMealPlansForBoard | jsonOk, handleRouteError | no |
| PATCH | `/api/master/rate-plans/[id]` | session | body:schema path:id | updateRatePlan | jsonOk, handleRouteError | no |
| DELETE | `/api/master/rate-plans/[id]` | session | path:id | deleteRatePlan | jsonOk, handleRouteError | no |
| GET | `/api/master/rate-plans` | session | — | listRatePlans | jsonOk, handleRouteError | no |
| POST | `/api/master/rate-plans` | session | body:schema | createRatePlan | jsonOk, handleRouteError | no |
| PATCH | `/api/master/revenue-codes/[id]` | session | body:schema path:id | updateRevenueCode | jsonOk, handleRouteError | no |
| GET | `/api/master/revenue-codes` | session | — | listRevenueCodes | jsonOk, handleRouteError | no |
| POST | `/api/master/revenue-codes` | session | body:schema | createRevenueCode | jsonOk, handleRouteError | no |
| GET | `/api/master/revenue-gl-mappings` | session | — | listRevenueGlMappings | jsonOk, handleRouteError | no |
| PUT | `/api/master/revenue-gl-mappings` | session | body:upsertSchema | setRevenueCodeRole, upsertRevenueGlMapping | jsonOk, handleRouteError | no |
| PATCH | `/api/master/room-types/[id]` | session | body:schema path:id | updateRoomType | jsonOk, handleRouteError | calls:recordHotelAudit |
| GET | `/api/master/room-types` | session | — | listRoomTypes | jsonOk, handleRouteError | no |
| POST | `/api/master/room-types` | session | body:schema | createRoomType | jsonOk, handleRouteError | no |
| PATCH | `/api/master/room-views/[id]` | session | body:schema path:id | updateRoomView | jsonOk, handleRouteError | no |
| GET | `/api/master/room-views` | session | — | listRoomViews | jsonOk, handleRouteError | no |
| POST | `/api/master/room-views` | session | body:schema | createRoomView | jsonOk, handleRouteError | no |

## mdm

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/mdm/person-lookup` | session RESERVATIONS_WRITE | body:request.json | assertPermission, buildMdmPersonLookupBody, getSatelliteSession, lookupGlobalPersonByFin | jsonError, jsonOk, handleRouteError | calls:lookupGlobalPersonByFin,resolvePersonIdentity |
| POST | `/api/mdm/person-merge` | session RESERVATIONS_WRITE | body:schema | linkGuestGlobalPerson | jsonOk, handleRouteError | calls:mergePersonRecords |
| GET | `/api/mdm/person-ops-profile` | session RESERVATIONS_READ | query:globalPersonId | assertPermission, getPersonOpsProfile, getSatelliteSession | jsonError, jsonOk, handleRouteError | calls:getPersonOpsProfile |

## medical

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/medical/alerts` | session MEDICAL_MANAGE | — | listAlerts | jsonOk, handleRouteError | no |
| POST | `/api/medical/alerts` | session MEDICAL_MANAGE | body:schema | createAlert | jsonOk, handleRouteError | no |
| POST | `/api/medical/orders` | session MEDICAL_MANAGE | body:labSchema,procSchema,orderSchema | addLabResult, createOrder, postProcedureToFolio | jsonOk, handleRouteError | no |

## migration

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/migration/[id]/submit` | session RESERVATIONS_WRITE | path:id | submitMigrationToRegistry | jsonOk, handleRouteError | no |
| GET | `/api/migration/[id]/submit` | session RESERVATIONS_READ | path:id | exportMigrationPayload | jsonOk, handleRouteError | no |
| GET | `/api/migration/registrations/[id]/prefill` | session RESERVATIONS_READ | path:id | getMigrationPrefill | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/migration/registrations` | session RESERVATIONS_READ | — | listMigrationRegistrations | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/migration/registrations` | session RESERVATIONS_WRITE | body:createSchema | createMigrationRegistration | jsonOk, handleRouteError | calls:requireHotelModule |

## night-audit

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/night-audit/eod-reports` | session REPORTS_READ | query:type,date | getEodReport | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/night-audit/preview` | session NIGHT_AUDIT_RUN | — | previewNightAudit | jsonOk, handleRouteError | no |
| GET | `/api/night-audit/reservation-updates` | session REPORTS_READ | query:from,to,action,format body:actionSchema | listNightAuditReservationUpdates, reservationUpdatesToCsv | jsonOk, handleRouteError, NextResponse(body) | no |
| POST | `/api/night-audit/run` | session NIGHT_AUDIT_RUN | — | runNightAudit | jsonOk, handleRouteError | no |
| GET | `/api/night-audit/runs` | session SCREEN_NIGHT_AUDIT\|NIGHT_AUDIT_RUN any-of | query:limit | listNightAuditRuns | jsonOk, handleRouteError | no |
| GET | `/api/night-audit/status` | session NIGHT_AUDIT_RUN\|REPORTS_READ any-of | — | getNightAuditStatus | jsonOk, handleRouteError | no |
| GET | `/api/night-audit/year-end` | session NIGHT_AUDIT_RUN | — | getYearEndPreview | jsonOk, handleRouteError | no |
| POST | `/api/night-audit/year-end` | session NIGHT_AUDIT_RUN | body:bodySchema | runYearEndAction | jsonOk, handleRouteError | no |

## notifications

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/notifications/[id]/read` | session | path:id | getSatelliteSession | jsonError, jsonOk, handleRouteError | no |
| PATCH | `/api/notifications/read-all` | session | — | getSatelliteSession | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/notifications` | session | — | getSatelliteSession | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/notifications/unread-count` | session | — | getSatelliteSession | jsonError, jsonOk, handleRouteError | no |

## payment-methods

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/payment-methods` | session FOLIO_READ | query:guest,accept-language | assertPermission, getSatelliteSession, hotelDeskPaymentMethods, hotelGuestTenders | jsonOk, handleRouteError | no |

## platform

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/platform/billing-snapshot` | session | — | getSatelliteSession, getSubscriptionMe | jsonOk, handleRouteError | calls:getSubscriptionMe |

## pms

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/pms/buffet-guest-nights` | REPORTS_READ | query:from,to | queryOccupancySeries | NextResponse.json, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/pms/guest-entitlements` | RESERVATIONS_READ | query:roomNumber,reservationId | getGuestEntitlements | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/pms/in-house` | RESERVATIONS_READ | query:query,roomNumber,limit | listInHouseGuests | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/pms/pos-shift-status` | NIGHT_AUDIT_RUN | — | getPosShiftStatus | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |
| PUT | `/api/pms/pos-shift-status` | NIGHT_AUDIT_RUN | query:x-era-organization-id body:putSchema | reportPosShiftStatus | jsonError, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/pms/reservations/[reservationId]/folio-summary` | FOLIO_READ | path:reservationId | getFolioSummaryForPos | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/pms/room-charges` | FOLIO_READ | query:externalTicketId,idempotencyKey | findRoomChargeByIdempotencyKey | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |

## pos

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/pos/reservations` | session RESERVATIONS_READ | query:date | listPosReservations | jsonOk, handleRouteError | no |
| POST | `/api/pos/reservations` | session RESERVATIONS_WRITE | body:schema | createPosReservation | jsonOk, handleRouteError | no |
| GET | `/api/pos/resources` | session RESERVATIONS_READ | — | listPosResources | jsonOk, handleRouteError | no |
| POST | `/api/pos/resources` | session MASTER_DATA_MANAGE | body:schema | createPosResource | jsonOk, handleRouteError | no |
| POST | `/api/pos/room-charge` | FOLIO_CHARGE | query:x-era-organization-id,idempotency-key body:schema | postRoomCharge | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |

## procedures

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/procedures/appointments/[id]` | session MEDICAL_MANAGE | body:finishSchema path:id | finishAppointment, markNoShow | jsonOk, handleRouteError | no |
| POST | `/api/procedures/appointments` | session MEDICAL_MANAGE | body:bodySchema | createAppointment | jsonOk, handleRouteError | no |
| GET | `/api/procedures` | session MEDICAL_MANAGE | query:reservationId,status,from,to | listAppointments, listProcedureServices | jsonOk, handleRouteError | no |

## public

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/public/booking/rates` | bearer-or-internal | — | — | NextResponse.json | no |
| GET | `/api/public/v1/availability` | see-handler | query:from,nights,adults,children,origin | ibeCorsHeaders, ibeErrorStatus, requireHotelModule, resolveIbeTenant | NextResponse.json | calls:resolveIbeTenant,requireHotelModule,searchIbeAvailability |
| POST | `/api/public/v1/bookings` | see-handler | query:idempotency-key,origin body:bodySchema | bookIbe, ibeCorsHeaders, ibeErrorStatus, requireHotelModule | NextResponse.json | calls:resolveIbeTenant,requireHotelModule,bookIbe |
| POST | `/api/public/v1/holds` | see-handler | query:origin body:bodySchema | createIbeHold, ibeCorsHeaders, ibeErrorStatus, requireHotelModule | NextResponse.json | calls:resolveIbeTenant,requireHotelModule,createIbeHold |

## reports

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/reports/[slug]/layout` | session REPORTS_READ | query:from,to,dim path:slug | isImplementedReportSlug, queryReportLayout | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/reports/[slug]/pdf` | session REPORTS_READ | query:from,to,dim path:slug | getReportLetterhead, isImplementedReportSlug, queryReportLayout, renderLayoutPdf, reportPeriodLabel | jsonError, handleRouteError | no |
| GET | `/api/reports/[slug]/xlsx` | session REPORTS_READ | query:from,to,dim path:slug | getReportLetterhead, isImplementedReportSlug, queryReportLayout, reportPeriodLabel | jsonError, handleRouteError | calls:layoutToXlsxBuffer |
| GET | `/api/reports/agency-cl-summary` | session REPORTS_READ | query:from,to,kind | listCityLedgerSummary | jsonOk, handleRouteError | no |
| GET | `/api/reports/agency-profitability` | session REPORTS_READ | query:from,to | reportAgencyProfitability | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/reports/booking-sources` | session REPORTS_READ | query:from,to | reportBookingSourceRevenue | jsonOk, handleRouteError | no |
| GET | `/api/reports/cancellations` | session REPORTS_READ | query:from,to | reportCancellationSummary | jsonOk, handleRouteError | no |
| GET | `/api/reports/event-profitability` | session REPORTS_READ | query:from,to | getEventProfitabilityReport | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/reports/guest-demographics` | session REPORTS_READ | query:from,to | reportGuestDemographics | jsonOk, handleRouteError | no |
| GET | `/api/reports/inhouse-daily` | session REPORTS_READ | query:date | listInhouseDaily | jsonOk, handleRouteError | no |
| PATCH | `/api/reports/invoices/[id]` | session FOLIO_PAYMENT | body:patchSchema path:id | setInvoiceIntegrateFlag | jsonOk, handleRouteError | no |
| GET | `/api/reports/invoices` | session REPORTS_READ | query:from,to,integrateOnly | listInvoiceReport | jsonOk, handleRouteError | no |
| GET | `/api/reports/night-audit-runs` | session NIGHT_AUDIT_RUN | query:limit | listNightAuditRunsReport | jsonOk, handleRouteError | no |
| GET | `/api/reports/occupancy` | session REPORTS_READ | body:querySchema | getOccupancyGrid | jsonOk, handleRouteError | no |
| GET | `/api/reports/pack/download` | session REPORTS_READ | query:businessDate | getReportLetterhead, queryReportLayout, renderLayoutPdf, reportPeriodLabel | jsonError, handleRouteError | calls:resolveNightAuditPackSlugs |
| GET | `/api/reports/pack` | session REPORTS_READ | query:businessDate | assertPermission, getReportBySlug, getSatelliteSession, resolveNightAuditPackSlugs | jsonError, jsonOk, handleRouteError | calls:resolveNightAuditPackSlugs |
| GET | `/api/reports/payment-voids` | session REPORTS_READ | — | listVoidedFolioPayments | jsonOk, handleRouteError | no |
| GET | `/api/reports/reconciliation` | session REPORTS_READ | query:businessDate | getReconciliationReport | jsonOk, handleRouteError | no |
| GET | `/api/reports/reservation-notes` | session REPORTS_READ | — | listReservationNotesReport | jsonOk, handleRouteError | no |
| GET | `/api/reports/reservation-times` | session REPORTS_READ | query:from,to,guest,agency | listReservationTimes | jsonOk, handleRouteError | no |
| GET | `/api/reports/reservations-grid` | session RESERVATIONS_READ | query:hasNotes,guestId,q,noteQ,status,page,pageSize,dateFrom,dateTo,queue,overdue,sort,dir | listReservationsForGrid | jsonOk, handleRouteError | no |
| GET | `/api/reports/room-changes` | session REPORTS_READ | — | listRoomChangePlans | jsonOk, handleRouteError | no |
| POST | `/api/reports/room-changes` | session RESERVATIONS_WRITE | body:createSchema | createRoomChangePlan, requestRoomMove | jsonOk, handleRouteError | no |

## reservation-groups

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/reservation-groups/[id]` | session RESERVATIONS_READ | path:id | listBookingStays | jsonOk, handleRouteError | no |
| PATCH | `/api/reservation-groups/[id]` | session RESERVATIONS_WRITE | body:patchSchema path:id | updateBookingEnvelope | jsonOk, handleRouteError | no |
| POST | `/api/reservation-groups/[id]` | session RESERVATIONS_WRITE | body:addStaySchema path:id | addStayToBooking | jsonOk, handleRouteError | no |
| PATCH | `/api/reservation-groups/assign` | session RESERVATIONS_WRITE | body:schema | assignReservationToGroup | jsonOk, handleRouteError | no |
| POST | `/api/reservation-groups/book` | session RESERVATIONS_WRITE | body:schema | collectStayOperationalGaps, createGroupBookingWithStays | jsonOk, handleRouteError | no |
| GET | `/api/reservation-groups` | session RESERVATIONS_READ | — | listGroupReservationsWithBalance | jsonOk, handleRouteError | no |
| POST | `/api/reservation-groups` | session RESERVATIONS_WRITE | body:createSchema | createReservationGroup | jsonOk, handleRouteError | no |

## reservations

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/reservations/[id]/add-room` | session RESERVATIONS_WRITE | path:id | addRoomStayFromReservation | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/amendments/preview` | session RESERVATIONS_WRITE | body:schema path:id | previewStayAmendment | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/amendments` | session RESERVATIONS_WRITE | body:schema path:id | applyStayAmendment | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/assign` | session RESERVATIONS_WRITE | body:schema path:id | assignRoom | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/attachments` | session RESERVATIONS_READ | path:id | listReservationAttachments | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/attachments` | session RESERVATIONS_WRITE | query:content-type,file,kind body:postSchema body:formData path:id | createReservationAttachment | jsonError, jsonOk, handleRouteError | calls:import,uploadReservationAttachmentFile |
| PATCH | `/api/reservations/[id]/cancel` | session RESERVATIONS_CANCEL | body:schema path:id | cancelReservation | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/card-authorizations` | session FOLIO_READ | path:id | listAuthorizations | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/card-authorizations` | session FOLIO_PAYMENT | body:holdSchema path:id | createCheckInHold | jsonOk, handleRouteError | no |
| PATCH | `/api/reservations/[id]/card-authorizations` | session FOLIO_PAYMENT | body:request.json path:id | captureAuthorization, releaseAuthorization | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/check-in` | session RESERVATIONS_CHECKIN | body:bodySchema path:id | checkInReservation | jsonOk, handleRouteError | calls:import,issueGuestQrToken |
| POST | `/api/reservations/[id]/check-out` | session RESERVATIONS_CHECKOUT | body:bodySchema,JSON path:id | checkoutReservation | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/clinic-checkout` | session RESERVATIONS_CHECKOUT bearer-or-internal | path:id | getReservation | jsonOk, handleRouteError | calls:import,fetch |
| GET | `/api/reservations/[id]/deposit-targets` | session FOLIO_READ | path:id | listDepositTargets | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/deposits/apply` | session FOLIO_PAYMENT | body:bodySchema path:id | getFolioReservationId, moveHeldDepositsOntoFolio | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/deposits` | session FOLIO_READ | path:id | listDeposits | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/deposits` | session FOLIO_PAYMENT | body:bodySchema path:id | recordDeposit | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/deposits/settle` | session FOLIO_PAYMENT | body:bodySchema path:id | carryDepositRemainder, payoutDepositRemainder | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/early-checkout-preview` | session RESERVATIONS_CHECKOUT | path:id | previewEarlyCheckoutUnusedNights | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/early-late-fees` | session RESERVATIONS_READ | query:checkInTime,checkOutTime path:id | previewEarlyLateFees | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/extras` | session FOLIO_CHARGE | body:schema path:id | addQuickCharge, getReservation | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/folio-routing` | session FOLIO_READ | path:id | getReservationFolioRouting | jsonOk, handleRouteError | no |
| PUT | `/api/reservations/[id]/folio-routing` | session FOLIO_CHARGE | body:putSchema path:id | upsertReservationFolioRouting | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/full` | session RESERVATIONS_READ | path:id | getReservationFull | jsonOk, handleRouteError | no |
| PATCH | `/api/reservations/[id]/full` | session RESERVATIONS_WRITE | body:reservationFullPatchSchema path:id | collectStayOperationalGaps, patchReservationFull | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/guest-overlaps` | session RESERVATIONS_READ | path:id | listNamedGuestOverlaps | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/journal` | session RESERVATIONS_READ\|SCREEN_SETTINGS | query:section,source path:id | assertPermission, getSatelliteSession, listReservationJournal, sessionHasHotelPermission | jsonOk, handleRouteError | calls:listReservationJournal |
| PATCH | `/api/reservations/[id]/lock` | session RESERVATIONS_WRITE | body:schema path:id | setReservationLocked | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/missed-nights` | session FOLIO_CHARGE\|NIGHT_AUDIT_RUN any-of | path:id | listMissedRoomNights | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/missed-nights` | session FOLIO_CHARGE\|NIGHT_AUDIT_RUN any-of | path:id | postMissedRoomNights | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/packages` | session RESERVATIONS_READ | path:id | listReservationPackages | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/packages` | session RESERVATIONS_WRITE | body:schema path:id | addReservationPackage | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/pax/[paxId]/clinic-admit` | session RESERVATIONS_CHECKIN | body:request.json path:id,paxId | admitGuestToClinic, revokeGuestClinicAdmit | jsonOk, NextResponse.json, jsonError, handleRouteError | no |
| POST | `/api/reservations/[id]/pax/[paxId]/depart` | session RESERVATIONS_CHECKOUT | body:request.json path:id,paxId | departGuestFromStay | jsonOk, jsonError, handleRouteError | no |
| POST | `/api/reservations/[id]/pax/[paxId]/move` | session RESERVATIONS_WRITE | body:request.json path:id,paxId | moveGuestBetweenStays | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/payment-cards` | session RESERVATIONS_READ | path:id | listReservationPaymentCards | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/payment-cards` | session RESERVATIONS_WRITE | body:schema path:id | addReservationPaymentCard | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/pricing/charge-all` | session RESERVATIONS_WRITE | path:id | chargeAllRoomNights | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/pricing/post-night` | session RESERVATIONS_WRITE | body:schema path:id | postRoomNight | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/pricing/recalc` | session RESERVATIONS_WRITE | path:id | recalcReservationDailyRates | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/pricing/spread` | session RESERVATIONS_WRITE | body:schema path:id | applyStayPercent, spreadManualNightly, spreadStayTotal | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/relocate` | session RESERVATIONS_WRITE | body:schema path:id | isClassSettlement, requestRoomMove | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/restore` | session RESERVATIONS_WRITE | body:schema path:id | restoreReservation | jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/room-changes` | session RESERVATIONS_READ | path:id | listRoomChangesForReservation | jsonOk, handleRouteError | no |
| DELETE | `/api/reservations/[id]` | session RESERVATIONS_CANCEL | body:schema path:id | deleteEmptyReservation | jsonOk, handleRouteError | no |
| PATCH | `/api/reservations/[id]/schedule` | session RESERVATIONS_WRITE | body:schema path:id | updateReservationSchedule | jsonOk, handleRouteError | calls:import,loadReservationAuditSnapshot,recordReservationDiff |
| POST | `/api/reservations/[id]/stay-split` | session RESERVATIONS_WRITE | body:schema path:id | getReservationFull, isClassSettlement, requestRoomMove, splitStayFromDate | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/swap-room` | session RESERVATIONS_WRITE | body:request.json path:id | swapReservationRooms | jsonError, jsonOk, handleRouteError | no |
| GET | `/api/reservations/[id]/tasks` | session RESERVATIONS_READ | path:id | listReservationTasks | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/tasks` | session RESERVATIONS_WRITE | body:schema path:id | addReservationTask | jsonOk, handleRouteError | no |
| POST | `/api/reservations/[id]/undo-checkout` | session RESERVATIONS_CHECKOUT | body:schema path:id | undoCheckout | jsonOk, handleRouteError | no |
| GET | `/api/reservations/arrivals` | session RESERVATIONS_READ | query:dateFrom,date,dateTo | listArrivals | jsonOk, handleRouteError | no |
| GET | `/api/reservations/guest-overlaps` | session RESERVATIONS_READ | query:guestId,checkIn,checkOut | listDraftGuestOverlaps | jsonOk, handleRouteError | no |
| GET | `/api/reservations` | session RESERVATIONS_READ | query:status,guestId,includeParty | listReservations | jsonOk, handleRouteError | no |
| POST | `/api/reservations` | session RESERVATIONS_WRITE | body:createSchema | collectStayOperationalGaps, createReservation | jsonOk, handleRouteError | no |

## room-plan

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/room-plan` | session RESERVATIONS_READ | body:querySchema | getRoomPlan | jsonOk, handleRouteError | no |

## room-service

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/room-service/qr` | session | query:roomId,tableCode | getSatelliteSession | jsonError, NextResponse.json, handleRouteError | no |

## rooms

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/rooms/[id]` | session MASTER_DATA_MANAGE | body:patchSchema path:id | updateRoomMasterData | jsonOk, handleRouteError | no |
| PATCH | `/api/rooms/[id]/status` | session ROOMS_STATUS | body:schema path:id | applyFrontOfficeRoomStatus | jsonOk, handleRouteError | no |
| GET | `/api/rooms` | session MASTER_DATA_MANAGE\|RESERVATIONS_READ\|ROOMS_STATUS\|HOUSEKEEPING_MANAGE any-of | query:scope | listRoomsForRack, listRoomsMaster | jsonOk, handleRouteError | no |
| POST | `/api/rooms` | session MASTER_DATA_MANAGE | body:createSchema | createRoom | jsonOk, handleRouteError | no |

## service

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/service/guest-request` | see-handler | body:bodySchema | createServiceRequest, findRoomIdByNumber | NextResponse.json, jsonOk | no |
| GET | `/api/service/recurring` | session | — | listRecurringServiceSchedules | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/service/recurring` | session | body:createSchema | createRecurringServiceSchedule | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |
| PUT | `/api/service/recurring` | bearer-or-internal cron-secret? | query:x-service-cron-secret,authorization | runDueRecurringSchedules | NextResponse.json, jsonOk | calls:runCronForEachTenant |
| PATCH | `/api/service/requests/[id]` | session | body:patchSchema path:id | updateServiceRequestStatus | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/service/requests` | session | query:status | listServiceRequests | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/service/requests` | session | body:createSchema | createServiceRequest | jsonError, jsonOk, handleRouteError | calls:requireHotelModule |

## settlement

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/settlement/pending/[id]/pay` | session FOLIO_PAYMENT | body:schema path:id | payPendingCharge | jsonOk, handleRouteError | no |
| POST | `/api/settlement/pending/[id]/void` | session FOLIO_VOID | body:schema path:id | voidPendingCharge | jsonOk, handleRouteError | no |
| POST | `/api/settlement/pending/basket/pay` | session FOLIO_PAYMENT | body:schema | payPendingBasket | jsonOk, handleRouteError | no |
| POST | `/api/settlement/pending` | FOLIO_PAYMENT | query:x-era-organization-id,idempotency-key body:schema | createPendingCharge | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission |
| GET | `/api/settlement/pending` | FOLIO_PAYMENT | query:status | assertPosBridgeOrPermission | jsonOk, handleRouteError | calls:assertPosBridgeOrPermission,import,listPendingCharges |
| GET | `/api/settlement/pending/summary` | session NIGHT_AUDIT_RUN | — | getPendingSummary | jsonOk, handleRouteError | no |

## spa

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| GET | `/api/spa/places` | session RESERVATIONS_READ | — | listSpaPlaces | jsonOk, handleRouteError | no |
| POST | `/api/spa/places` | session MASTER_DATA_MANAGE | body:schema | createSpaPlace | jsonOk, handleRouteError | no |
| POST | `/api/spa/slots` | session | body:bodySchema | createBookingSlot, getSatelliteSession, requireHotelModule | jsonError, jsonOk, handleRouteError | calls:requireHotelModule,createBookingSlot |

## stock

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/stock/movements` | session MASTER_DATA_MANAGE | body:schema | postStockMovement | jsonOk, handleRouteError | no |
| PATCH | `/api/stock/products/[id]` | session MASTER_DATA_MANAGE | body:schema path:id | updateProduct | jsonOk, handleRouteError | no |
| GET | `/api/stock/products` | session MASTER_DATA_MANAGE | — | listProducts | jsonOk, handleRouteError | no |
| POST | `/api/stock/products` | session MASTER_DATA_MANAGE | body:schema | createProduct | jsonOk, handleRouteError | no |
| GET | `/api/stock/warehouses` | session MASTER_DATA_MANAGE | — | listWarehouses | jsonOk, handleRouteError | no |
| POST | `/api/stock/warehouses` | session MASTER_DATA_MANAGE | body:schema | createWarehouse | jsonOk, handleRouteError | no |

## tourism

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/tourism/[id]/retry` | session RESERVATIONS_CHECKIN | path:id | retryTourismSubmission | jsonOk, handleRouteError | no |
| GET | `/api/tourism/failed` | session RESERVATIONS_READ | — | listFailedTourismSubmissions | jsonOk, handleRouteError | no |

## tours

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| POST | `/api/tours/bookings/[id]/board` | session RESERVATIONS_WRITE | path:id | markTourBoarded | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/tours/bookings/[id]/pay` | session FOLIO_PAYMENT | body:bodySchema path:id | payTourBooking | jsonOk, handleRouteError | calls:requireHotelModule |
| DELETE | `/api/tours/bookings/[id]` | session RESERVATIONS_WRITE | body:cancelSchema path:id | removeTourBooking | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/tours/departures/[id]/bookings` | session RESERVATIONS_WRITE | body:bodySchema path:id | addTourBooking | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/tours/departures/[id]/close-boarding` | session RESERVATIONS_WRITE | body:bodySchema path:id | closeTourBoarding | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/departures/[id]/manifest` | session RESERVATIONS_WRITE | path:id | getTourDeparture | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/departures/[id]` | session RESERVATIONS_WRITE | path:id | getTourDeparture | jsonOk, handleRouteError | calls:requireHotelModule |
| PATCH | `/api/tours/departures/[id]` | session RESERVATIONS_WRITE | body:patchSchema path:id | updateTourDeparture | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/departures` | session RESERVATIONS_WRITE | query:from,to,status | listTourDepartures | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/tours/departures` | session RESERVATIONS_WRITE | body:bodySchema | createTourDeparture | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/in-house` | session RESERVATIONS_WRITE | — | listEligibleStaysForTour | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/policy` | session RESERVATIONS_WRITE\|MASTER_DATA_MANAGE any-of | — | getTourOpsPolicy | jsonOk, handleRouteError | calls:requireHotelModule |
| PATCH | `/api/tours/policy` | session MASTER_DATA_MANAGE | body:patchSchema | saveTourOpsPolicy | jsonOk, handleRouteError | calls:requireHotelModule |
| GET | `/api/tours/templates` | session RESERVATIONS_WRITE | — | listTourTemplates | jsonOk, handleRouteError | calls:requireHotelModule |
| POST | `/api/tours/templates` | session RESERVATIONS_WRITE | body:bodySchema | createTourTemplate | jsonOk, handleRouteError | calls:requireHotelModule |

## transfers

| Method | URL | Auth | Input | Service | Output | Logic in route |
|---|---|---|---|---|---|---|
| PATCH | `/api/transfers/[id]` | session RESERVATIONS_WRITE | body:patchSchema path:id | assignVehicle, cancelTransfer, completeTransfer | jsonOk, handleRouteError | no |
| GET | `/api/transfers` | session RESERVATIONS_WRITE | query:reservationId,guestId,status,direction,hasFlight,from,to | listTransferOrders, listVehicles | jsonOk, handleRouteError | no |
| POST | `/api/transfers` | session RESERVATIONS_WRITE | body:bodySchema | createTransferOrder | jsonOk, handleRouteError | no |
