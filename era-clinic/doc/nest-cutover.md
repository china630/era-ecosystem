# Clinic API cutover (Next route handlers to Nest)

HTTP edge only. Algorithms stay in `src/domain` and `src/lib`. UI stays on Next.

Regenerate handlers: `npm run nest:generate` (`scripts/generate-nest.mjs`).

- Generated routes: 228. Three kit edges are not generated and are mounted in `nest/kit-routes.ts`: `GET`+`POST` `/api/internal/v1/organization/bind` (bind, then clinic roles and catalog ensure), `GET`+`POST` `/api/internal/v1/runtime-config`, `GET` `/api/platform/billing-status`.
- Authenticated GET parity, one request at a time. After the local schema gap (`paid_at` / `paid_by_user_id` on Visit, LabOrder, ProcedureOrder) was applied, 84 paths matched status and body. The queue then stopped because the Next dev server exited (corrupt webpack cache). `jsonError` now keeps its extra fields, so Nest returns `code` on the hotel revenue catalog error. The paths after `/api/patients/:id` were not rechecked against Next, because `route.ts` was already gone.
- `app/api/**/route.ts` is removed. Nest is the API. Regenerate only while those route files exist.
- Local front door: `npm run front` listens on `127.0.0.1:3222` (`CLINIC_FRONT_PORT`; Docker already holds 3203). `/api` goes to Nest **13203**. Pages go to Next **23203**. The container publishes **3203** and uses those same internal ports.
- Staff login cookie on the login handler stays 12 hours.
