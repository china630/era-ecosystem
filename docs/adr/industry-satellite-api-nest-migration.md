# ADR: Industry satellite API on Nest (platform debt)

**Status:** Accepted (debt recorded — **not started**)  
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

- Audit “done” on Hotel/F&B/Clinic ≠ Nest everywhere.
- Claiming “one HTTP framework across ERA” without this ADR being **Implemented** is false.
- Until migration starts, Nest/Next dual stack is an **accepted platform residual**, ranked P0 for return — not forgotten.

## Non-goals (until this ADR moves to Implementing)

- Rewriting hotel (or other industry) APIs onto Nest in audit PRs.
- Blocking Layer A fail-closed work on Next waiting for Nest.
- Merging Finance Nest process into the hotel Next process.

## Related

- [era-mutation-audit-standard.md](./era-mutation-audit-standard.md) — Layer A stack patterns; open debts  
- [era-architecture-boundaries.mdc](../../.cursor/rules/era-architecture-boundaries.mdc) — planes  
- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) — P0 debt index  
- Follow-up plan: [mutation-audit-depth.plan.md](../../.cursor/plans/mutation-audit-depth.plan.md)
