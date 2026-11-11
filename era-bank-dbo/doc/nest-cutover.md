# Bank DBO API cutover (Next route handlers to Nest)

HTTP edge only. UI stays on Next.

- Nest listens on 13211. Next dev listens on 23211. Public port stays 3211.
- Anonymous GET parity passed for generated GET routes and kit GETs (`bind`, `runtime-config`). Those `route.ts` files are removed.
- Prisma client had to be generated locally before Nest or Next would boot.
- Closed mutation routes matched 401 with an empty body (8 files removed). Asan, OTP, and logout are on Nest, and `app/api` has no route files left.
