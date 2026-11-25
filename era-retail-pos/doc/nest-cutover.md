# Retail API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13204. Next dev listens on 23204. Public port stays 3204.
- API routes are Nest controllers in `nest/native`. There is no generator and no `nest/generated`.
- Kit billing, runtime-config, and organization bind pass Express headers and body. Staff session is read from the Express cookie and headers. Auth and locale cookies are written with Express `cookieSeconds` (seconds times 1000).
- UI stays on Next. `app/api` has no route files.
- A duplicate `serializePermissions` import in `ensure-system-retail-roles.ts` made the Next login compile fail. It is removed.
- Closed mutation routes matched 401 with an empty body (22 files removed). The remaining public handlers are on Nest, and `app/api` has no route files left.
