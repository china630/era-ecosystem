# ADR: ERA 3-tier design tokens (hybrid)

**Status:** Accepted  
**Date:** 2026-07-20  
**Deciders:** platform UI  

## Context

Industry satellites share a large surface of forms, modals, tables, and filters.
Authoring sizes, colors, and placement per control does not scale. A prior
3-tier token effort was never committed as files under `tokens/` (git archaeology
2026-07-20 found only the Field system + flat `design-system.ts`). Emergency
resets for green CI made uncommitted design work easy to lose.

We need a durable, documented system that:

1. Centralizes raw visual values.
2. Maps roles (text, surface, action) without repeating hex.
3. Emits Tailwind class strings the JIT compiler can see.
4. Automates field width / align / filter control from a data type.

## Decision

Adopt **W3C-style 3-tier Design Tokens** in a **hybrid TypeScript** form
(no Style Dictionary / DTCG JSON pipeline yet):

| Layer | Path | Role |
|-------|------|------|
| L1 Primitives | `packages/satellite-kit/src/ui/tokens/primitives.ts` | Raw hex, sizes, radii, spacing, field `ch` widths |
| L2 Semantic | `packages/satellite-kit/src/ui/tokens/semantic.ts` | Role aliases (`text.primary`, `action.fill`, …) referencing L1 only |
| L3 Components | `packages/satellite-kit/src/ui/tokens/components.ts` | Static Tailwind class strings aligned to L1 (JIT-safe literals) |

Automation on top of the tiers:

| Module | Role |
|--------|------|
| `tokens/resolve-field.ts` | `(dataType, elementType?, context?) -> preset, width, align, format, filterControl` |
| `tokens/column-schema.ts` | Column declaration -> cell align + `EraListFilterBar` filter specs |

Public facade: `packages/satellite-kit/src/ui/design-system.ts` re-exports L3
(so existing imports keep working). Barrel: `@era/satellite-kit/ui`.

**Why hybrid (TS constants, not DTCG JSON):**

- Zero build step; type-safe; works with current `lint:design-tokens`.
- Tailwind JIT requires complete class literals in scanned sources; L3 keeps
  those literals while L1/L2 remain the value source of truth.
- Formal DTCG + Style Dictionary can be added later if Figma sync / multi-theme
  becomes a requirement — L1 keys should map 1:1 to future JSON tokens.

## Enforcement (anti-loss)

1. **Docs:** this ADR + `DESIGN.md` section "Three-tier design tokens" +
   `docs/UI_PLAYBOOK_SATELLITES.md` pointer + `packages/.cursor/rules/shared-packages.mdc`.
2. **Lint:** `npm run lint:token-layers` (`scripts/lint-token-layers.mjs`) —
   L2 has no raw hex; every L3 hex exists in L1; facade has no hex.
3. **Do not** emergency-reset `packages/satellite-kit` to green CI
   (see `.cursor/rules/era-no-emergency-reset.mdc`). Park unfinished token
   work on a branch; never delete L1/L2/L3 to unblock a monorepo PR.

## Consequences

### Positive

- One place to change brand colors / control heights.
- `resolveField` + `columnFilters` make "table => filters" mechanical.
- Survives refactors because layers and lint are in-repo and documented.

### Negative / trade-offs

- L3 still duplicates hex as Tailwind literals (by design for JIT); drift is
  caught by `lint:token-layers`, not by TypeScript alone.
- Existing kit/app files may still contain raw hex outside `tokens/`;
  those remain `lint:design-tokens` baseline debt until migrated.

## Usage (authors)

```ts
import {
  resolveField,
  resolveColumns,
  columnFilters,
  Field,
  EraListFilterBar,
  type ColumnSchema,
} from "@era/satellite-kit/ui";

const columns: ColumnSchema[] = [
  { id: "name", header: "Name", dataType: "shortText" },
  { id: "status", header: "Status", dataType: "enum" },
  { id: "amount", header: "Amount", dataType: "amount" },
  { id: "checkIn", header: "Check-in", dataType: "date" },
];

const filters = columnFilters(columns); // text / select / amountRange / dateRange
const amount = resolveField("amount"); // preset amount, align right, filter amountRange
```

List screens: place `EraListFilterBar` between `PageHeader` and the table;
wire filter controls from `columnFilters` (or hand-build with the same dataTypes).

## Change process

1. New color/size -> edit **L1** `primitives.ts`.
2. New role alias -> edit **L2** `semantic.ts` (reference L1 only).
3. Update matching Tailwind strings in **L3** `components.ts`.
4. Run `npm run lint:token-layers` and `npm run build -w @era/satellite-kit`.
5. If field taxonomy changes -> update `resolve-field.ts` + `field-presets.ts`
   consumers; update DESIGN.md Field width taxonomy table.

## Related

- `DESIGN.md` (global visual spec)
- `docs/UI_PLAYBOOK_SATELLITES.md`
- `docs/FIELD_SYSTEM_MODAL_WAVES.md`
- `scripts/lint-design-tokens.mjs` (raw input / radius baseline)
- `scripts/lint-token-layers.mjs` (layer integrity)
