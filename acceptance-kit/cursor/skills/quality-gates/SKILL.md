---
name: quality-gates
description: >-
  Run acceptance consistency and project quality tooling before claiming a PR
  ready, after AuthZ/security edits, or when the user asks for gates.
---

# Quality gates

## Fast path (local)

Minimum required by this kit:

```powershell
pwsh -NoProfile -File scripts/check-acceptance-consistency.ps1
```

If the repo has a wrapper (recommended), prefer:

```powershell
pwsh -NoProfile -File scripts/run-quality-gates.ps1
```

Wire optional flags locally (`-SkipLint`, `-WithE2E`, …) — not part of the portable kit.

## What acceptance gate means

| Gate | Tool | Blocks |
|------|------|--------|
| Acceptance | `check-acceptance-consistency.ps1` | False-green docs / false `ga` |

Add secrets/lint/vuln/e2e in the host repo CI; agent prefers scripts over ad-hoc commands.

## Agent rules

- Prefer these scripts over inventing one-off commands.
- After FAIL: fix or demote Matrix Scaffold to 🟡 — do not greenwash.
