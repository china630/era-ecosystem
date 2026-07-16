# Seeds (Data-Hub Phase 2)

Default layers: `core`, `national`, `hr` (bank / geo / trade are no-ops — hub SoR).

- **core:** currencies, RBAC, system users, minimal UoM/tax FK cache for system product templates
- **national:** AZ stat report definitions only (tax rates + NAS chart → hub)
- **bank / geo / trade:** log-and-skip; sync catalogs from era-data-hub into FK cache tables
- **Currency** remains Finance-owned and seeded in core

See `docs/adr/era-data-hub.md` Phase 2 contract.
