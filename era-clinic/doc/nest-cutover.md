# Clinic API cutover (Next route handlers to Nest)

HTTP edge only. Algorithms stay in `src/domain` and `src/lib`. UI stays on Next.

Domain routes are Nest controllers in `nest/native/controllers/`. Each method keeps the handler body that used to live in `nest/generated`. `npm run nest` uses `tsconfig.nest.json` (`experimentalDecorators`). There is no generator and no `nest/generated`.

Guest-care is `GuestCareController`. Kit bind, runtime-config, and billing-status are `ClinicKitController` methods. They pass Express headers and the parsed body into the kit. They do not build a Web Request. Bind still ensures clinic roles and catalog unless the org is `demo-org`.

- Staff session cookie is 8 hours (Express `maxAge` in milliseconds). The presets cookie on login stays 30 days.
- Staff routes use `ClinicApiGuard` and return `withClinicStaff(...)`. Public routes return `withClinicHttp(...)`. Audit, query, and headers read the Express request. `nestWebRequest` is gone.
- Local front door: `npm run front` listens on `127.0.0.1:3222` (`CLINIC_FRONT_PORT`; Docker already holds 3203). `/api` goes to Nest **13203**. Pages go to Next **23203**. The container publishes **3203** and uses those same internal ports.

See ADR: [docs/adr/clinic/clinic-nest-native-controllers.md](../../docs/adr/clinic/clinic-nest-native-controllers.md).
