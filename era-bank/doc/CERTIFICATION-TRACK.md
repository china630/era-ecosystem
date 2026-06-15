# Bank certification track (post Ops UX GA)

Parallel roadmap — **does not block** teller back-office pilot. Engine CBS MVP (P0–P7) and ops UI GA are prerequisites.

## Tracks

| Track | Scope | Owner repo |
|-------|--------|------------|
| Payment rails | AZIPS / AÖS / SWIFT production sandbox (replace stub adapter) | `era-bank-core` |
| FMN / CBAR | Live submission APIs + template certification | `era-bank-core` |
| Sanctions | Daily OFAC/EU/UN ingest via data-hub — **BLOCKED** (seed UI STUB `/aml/screen`; see [reference-data-phase2-catalogs.md](../../docs/adr/reference-data-phase2-catalogs.md)) | `era-bank-core` |
| Cards | AzeriCard/MilliKart production sandbox | `era-bank-core` |
| Security | Third-party pentest + OWASP ZAP CI | both |
| HA / EOD | Advisory lock hardening per [EOD-HA.md](../../era-bank-core/doc/EOD-HA.md) | `era-bank-core` |
| On-prem | Full ref-data export `ref-data:export` | `era-bank-core` |

## Exit criteria

- [ ] Live rail ACK for at least one outbound payment in staging
- [ ] FMN file accepted by regulator test endpoint (or documented waiver)
- [ ] Pentest report with no critical open items
- [ ] ADR [era-bank-core.md](../../docs/adr/era-bank-core.md) bumped to **Accepted (GA implemented)**

## References

- [SECURITY-CHECKLIST.md](../../era-bank-core/doc/SECURITY-CHECKLIST.md)
- [UAT-SMOKE-FULL.md](../../era-bank-core/doc/UAT-SMOKE-FULL.md)
