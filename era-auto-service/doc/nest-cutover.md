# Auto service API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13208. Next dev listens on 23208. Public port stays 3208.
- Anonymous GET parity passed for generated GET routes and kit GETs. Those `route.ts` files are removed.
- Closed mutation routes matched 401 with an empty body (11 files removed). SSO, events, and locale are on Nest, and `app/api` has no route files left.
