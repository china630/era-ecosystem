# ADR: Clinic Nest native controllers

## Status

Accepted — 2026-11-25 (reconciled with nest-cutover + code)

## Decision

1. Domain HTTP for clinic lives in `era-clinic/nest/native/controllers/*.controller.ts`. Methods call the same domain functions as the old generated handlers. `nest/generated` and `scripts/generate-nest.mjs` are gone. New controllers must be registered in `era-clinic/nest/native/clinic-native.module.ts` `controllers` array.
2. `npm run nest` loads `tsconfig.nest.json` so parameter decorators compile. Bootstrap is `era-clinic/nest/main.ts` (`ClinicNativeModule` + kit + guest-care + audit-exempt).
3. Guest-care stays on exact paths in `GuestCareController` (`guest-care-routes.ts`). Kit bind, runtime-config, and billing-status stay in `ClinicKitController` (`kit-routes.ts`). There is no `@All("api/*")` and no `ClinicEdgeController` name.
4. Kit handlers use `expressKitHeaders` / `KitHttpResult` (no `nestWebRequest`). Staff routes use `ClinicApiGuard` + `withClinicStaff`; public routes use `withClinicHttp`. Helpers live in `nest/bridge.ts`.
5. Staff cookie max age is 8 hours in Express milliseconds. Presets cookie on login stays 30 days. This does not change sell, Pilot, or Gate.

## Local ports

Front door `npm run front` on `127.0.0.1:3222` (`CLINIC_FRONT_PORT`). `/api` → Nest **13203**; pages → Next **23203**. Docker publishes **3203**.

## Related

- [era-clinic/doc/nest-cutover.md](../../../era-clinic/doc/nest-cutover.md)
- [industry-satellite-api-nest-migration.md](../industry-satellite-api-nest-migration.md) (platform pattern; stays flat)
