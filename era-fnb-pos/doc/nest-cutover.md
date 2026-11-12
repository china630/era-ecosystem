# F&B API cutover (Next route handlers to Nest)

HTTP edge only. Algorithms stay in services. UI stays on Next.

Regenerate: `npm run nest:generate`.

- Generated routes: 121. Kit edges `organization/bind`, `runtime-config`, and `platform/billing-status` are mounted in `nest/kit-routes.ts`.
- Anonymous GET parity passed for every generated GET plus the three kit GETs (72 route files removed). Nest returns 401 for a non-public `/api` call with no staff cookie, matching Next middleware.
- Closed mutation routes matched that same 401 with an empty body, and 45 more `route.ts` files were removed. The last public handlers (pin, SSO, events, locale, staff-provision, settlement-confirmed, kafe bootstrap) are registered on Nest and their `route.ts` files are removed. `app/api` has no route files left.
- Nest listens on `NEST_PORT` (default 13202) at `127.0.0.1`. Public port stays 3202.
