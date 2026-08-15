---
name: quality-gates
description: >-
  Run acceptance consistency and ERA quality tooling before claiming a PR
  ready, after AuthZ/security edits, or when the user asks for gates.
---

# Quality gates

## Fast path (local)

```bash
npm run check:acceptance
npm run run:quality-gates
```

Strict acceptance (SHIPPED/UAT/rollup checks):

```bash
npm run check:acceptance:strict
```

## What each gate means

| Gate | Tool | Blocks |
|------|------|--------|
| Acceptance | `check-acceptance-consistency.mjs` | False-green docs / false `ga` / missing SSOT |
| Integration | `audit:integration:strict` | MDM/hub/workforce contract drift |
| Design tokens | `lint:design-tokens`, `lint:token-layers` | Token layer violations |

## Agent rules

- Prefer these scripts over inventing one-off commands.
- After FAIL: fix or demote Matrix Scaffold to 🟡 — do not greenwash.
- Product sell/show status lives in Product-Readiness + `docs/editions/*.yaml`, not MODULES_CATALOG DONE.
