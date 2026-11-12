# ADR: Industry satellite API on Nest (platform debt)

**Status:** Implementing — code cutover 2026-11-12 (Nest HTTP, Next UI). Not Pilot, not a sell or Gate change.  
**Date:** 2026-10-28  
**Priority:** **P0 platform** (highest open platform-architecture debt)  
**Owner context:** Solo product + Cursor agent (no separate eng team). Calendar cost competes with Nafta pilot delivery.

## Context

ERA runs **two HTTP stacks** by historical plane choice — not by mutation-audit design:

| Plane | API stack | UI |
|-------|-----------|-----|
| Finance / Orchestrator API | **NestJS** | Next (separate `apps/web` or launcher) |
| Industry satellites (hotel, F&B, clinic, …) | **Next.js App Router** (`app/api/**/route.ts`) | Same Next app |

Finance Layer A audit uses a **global Nest interceptor** (hard to bypass). Satellites use a **`jsonOk` hook** plus fail-closed CI (`check:mutation-audit-belt`, Wave A 2026-10-29) — Nest still wins for belt completeness and DTO/ValidationPipe uniformity.

Product ask for “one audit standard” exposed this split. Unifying **audit behavior** does **not** require rewriting hotel API onto Nest. Unifying the **API framework** does — and that is a different program.

## Decision

1. **Record** industry satellite API → Nest (Finance-shaped: Nest API + Next UI/proxy) as a **P0 platform debt**.
2. **Do not** start hotel Nest migration as a side-effect of mutation-audit waves.
3. **Mutation audit** closes Layer A gaps on the **current Next stack** (fail-closed belt + CI). See [era-mutation-audit-standard.md](./era-mutation-audit-standard.md).
4. Nest migration, when scheduled, starts with an explicit cutover ADR + URL/proxy plan; hotel first (~370 `route.ts` files today), then other industry Next satellites.

## Scale (hotel only, order of magnitude)

- ~370 `app/api/**/route.ts`, ~160 UI pages kept on Next, ~100 Prisma models.
- Solo + agent: full cutover is **many months** of focused work; FO/folio/NA “API MVP” still **months**, not a sprint.
- F&B / clinic / other Next sats multiply the program if done the same way.

## Consequences

- Audit “done” on Hotel/F&B/Clinic is not a sell or Pilot claim.
- The HTTP API process is Nest. Next remains the UI. Calling that Pilot, Gate, or `ga` is still false.
- Field proof and route-by-route UAT are still open.

## Non-goals (this cutover)

- Treating the Nest move as Scaffold ✅, SHIPPED, or a sell/`ga` change.
- Merging the Finance Nest process into a satellite Next UI process.

## Related

- [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) — Layer A stack patterns; open debts  
- [era-architecture-boundaries.mdc](../../.cursor/rules/era-architecture-boundaries.mdc) — planes  
- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) — P0 debt index  
- Follow-up plan: [mutation-audit-depth.plan.md](../../.cursor/plans/mutation-audit-depth.plan.md)
