# Bank API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13210. Next dev listens on 23210. Public port stays 3210.
- Anonymous GET parity passed for generated GET routes, kit GETs, and the 24 engine-proxy prefixes. Those `route.ts` files, including `[[...path]]` proxies, are removed.
- Closed mutation routes matched 401 with an empty body (4 files removed). SSO exchange is on Nest, and `app/api` has no route files left.
