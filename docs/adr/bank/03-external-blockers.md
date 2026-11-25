# ERA Bank — external blockers (live / certification)

**Status:** Living register  
**Date:** 2026-11-25  
**Index:** [README.md](./README.md) · Inventory [Bank-Capability-Inventory.md](../../acceptance/Bank-Capability-Inventory.md)

Honest list of dependencies that block **live** or **certified** claims while lab scaffolds may exist in code.

| Area | Blocker | Owner / gate | Inventory / YC |
|------|---------|--------------|----------------|
| Legal | First-source law interpretation for ADİF file layout, leasing tax, open-banking consent wording | **[U] Lawyer** | P2-5 ADİF registry [U] |
| CBAR | Live prudential submit, credit registry export, Open Banking central gateway | **CBAR** sandbox / MOU | YC-E5, YC-E4, Open Banking |
| AKB | Credit bureau score and registry file exchange | **AKB** / Mərkəzi Kredit Reyestri partner UAT | `CAP-LN-AKB` DECLARED |
| ASAN / SİMA | Qualified electronic signature for DBO login | **ASAN İmza** / **SİMA** | YC-E3, `CAP-DBO-ASAN` |
| Cards | Issuer auth, clearing, 3DS on processing partner testbench | **AzeriCard** / **MilliKart** | YC-E2, `CAP-CARD-LIVE` |

**Rule:** do not mark Product Readiness Pilot or edition `pilot_ready` for a row while its blocker row remains open without documented sandbox evidence.