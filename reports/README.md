# Acceptance / stage-gate reports

**Convention**

| Artifact | Purpose |
|----------|---------|
| `<product>-stage-<wave>.log` | Raw gate output (gitignored) |
| `<product>-stage-<wave>-signoff.md` | Committed gate signoff (scaffold-gate-pass) |
| `<product>-stage-<wave>-e2e.log` | Optional E2E log (gitignored) |
| `<product>-pilot-lab-signoff.md` | Lab RT checklist signed |

Raw `*.log` under `reports/` are gitignored. Commit **signoff markdown** only.

Products: platform, clinic, hotel, finance, bank, fnb, retail, crm, …
