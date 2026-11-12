# Retail API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13204. Next dev listens on 23204. Public port stays 3204.
- Anonymous GET parity passed for the generated GET routes and the kit GETs (`bind`, `runtime-config`, `billing-status`). Those `route.ts` files are removed.
- A duplicate `serializePermissions` import in `ensure-system-retail-roles.ts` made the Next login compile fail. It is removed.
- Closed mutation routes matched 401 with an empty body (22 files removed). The remaining public handlers are on Nest, and `app/api` has no route files left.
