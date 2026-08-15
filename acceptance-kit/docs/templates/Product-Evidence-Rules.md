# <Product> — Evidence Rules

**Canon:** [`Product-Acceptance-Standard.md`](products/Product-Acceptance-Standard.md)

## What counts as proof

| Claim | Minimum proof |
|-------|----------------|
| `gate[x]` | Stage-gate script exit 0 + log under `reports/` |
| Scaffold ✅ | Test/golden covering PRD AC **including negative path** |
| Scaffold 🟡 | Partial proof / stub with explicit mode / open residual |
| Pilot lab `[x]` | Lab RT checklist signed + linked log |
| Pilot field `[x]` | Field / customer evidence (not synthetic alone) |
| Edition `ga` | Pilot-ready + sign-off; yaml is SSOT |

## Forbidden as sole proof

- Chat assertion / «works on my machine» without artifact
- Green stage-gate alone → Scaffold ✅
- Marketing deck alone → Readiness ✅
- Soft `ga (partner)` prose while yaml = `mvp`

## Artifact naming (suggested)

```
reports/<product>-stage-<wave>.log
reports/<product>-stage-<wave>-signoff.md
reports/<product>-pilot-lab.log
```
