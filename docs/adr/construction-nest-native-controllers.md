# ADR: Construction Nest native Controllers (cutover from generate-nest)

## Status

Accepted — 2026-11-20

## Context

`era-construction` hosted HTTP on Nest via Express handlers in `nest/generated/*`, produced by `scripts/generate-nest.mjs` from Next `app/api/**/route.ts`. The Next API tree was emptied; the generator became a dead path. Domain logic already lived in `@/lib/*.service.ts`.

## Decision

1. **Native Nest Controllers** under `era-construction/nest/native/controllers/` call the same `@/lib` services (and integration helpers) that the generated Express edge used.
2. **Staff auth** uses `ConstructionStaffGuard` → `getSatelliteSession({ cookies, headers })` from the Express request.
3. **Tenancy** uses `withStaffTenant` (satellite tenant ALS).
4. **Kit bind, runtime-config, and billing-status** are `KitApiController` methods on exact paths. They pass Express headers and the parsed body into the kit. They do not build a Web Request. Do not put those paths behind `@All('api/*')` — that shadowed native controllers and hung unmatched GETs.
5. **`npm run nest:generate` is retired** (exits non-zero). Do not revive generator for Construction.
6. Nest Controllers require `experimentalDecorators` + `emitDecoratorMetadata` (`tsconfig.json` / `tsconfig.nest.json`); `npm run nest` uses `tsx --tsconfig tsconfig.nest.json`.
7. **`nest/generated/` is gone** — domain HTTP is Controllers only; kit is `kit-api.controller.ts`.
8. **Nest edge is Next-free** — no `next/server` / `next/headers` in `nest/**` or Nest-loaded `api-utils`. Auth/locale cookies use Express `res.cookie`; errors are `{ status, body }` maps; staff session reads Express cookie and header readers. Next remains the UI host only.
9. **Cookie TTL units** — Express `maxAge` is milliseconds. Auth/locale helpers convert from the former Next/kit **seconds** values (`setStaffAuthCookie`, `expressCookieFromSeconds`).

## Rollout evidence

- Controllers registered in `ConstructionNativeModule`.
- Former `nest/generated/*` removed.
- Negative unit tests for estimate service remain; Nest smoke test covers health + controller file set.
