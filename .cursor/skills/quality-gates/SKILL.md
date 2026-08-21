---
name: quality-gates
description: >-
  Run acceptance consistency and ERA quality tooling before claiming a PR
  ready, after AuthZ/security edits, before git push / era-git-ship publish,
  or when the user asks for gates.
---

# Quality gates

## Fast path (local)

```bash
npm run check:acceptance
npm run run:quality-gates
```

**Before git push / «шип + пуш»** (quality-gates + scoped app tests — skill `era-git-ship`):

```bash
npm run ship:prepush
```

Strict acceptance (SHIPPED/UAT/rollup checks):

```bash
npm run check:acceptance:strict
npm run ship:prepush:strict
```

## What each gate means

| Gate | Tool | Blocks |
|------|------|--------|
| Acceptance | `check-acceptance-consistency.mjs` | False-green docs / false `ga` / missing SSOT |
| Satellite raw SQL | `check:satellite-raw-sql` | `$queryRaw` / `$executeRaw` in satellite runtime (no tenant filter) |
| Integration | `audit:integration:strict` | MDM/hub/workforce contract drift |
| Design tokens | `lint:design-tokens`, `lint:token-layers` | Token layer violations |
| Ship pre-push | `npm run ship:prepush` | Same as `run:quality-gates` plus scoped test/build for touched `era-*` (finance NAS + integration). See skill `era-git-ship`. |

## Agent rules

- Prefer these scripts over inventing one-off commands.
- After FAIL: fix or demote Matrix Scaffold to 🟡 — do not greenwash. For ship/push: **do not push** until `npm run ship:prepush` PASS.
- Product sell/show status lives in Product-Readiness + `docs/editions/*.yaml`, not MODULES_CATALOG DONE.
- Docker/Prisma health is local UI/UX only — not a ship gate.
