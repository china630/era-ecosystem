# Wholesale API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13209. Next dev listens on 23209. Public port stays 3209.
- Anonymous GET parity passed for generated GET routes and kit GETs. Those `route.ts` files are removed.
- Closed mutation routes matched 401 with an empty body (7 files removed). SSO, events, and locale are on Nest, and `app/api` has no route files left.
