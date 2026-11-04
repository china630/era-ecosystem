# ADR: Commercial topology and suspend cascade

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [org-operating-mode.md](./org-operating-mode.md) · [commercial-outlet-registry.md](./commercial-outlet-registry.md) · [cp-workforce-org-units.md](./cp-workforce-org-units.md)

## Context

Owners and SuperAdmin need one readable tree: who pays, which department org, which satellite product, which POS outlet — plus an operational kill at every level so billing and access stop without deleting data. UI previously flattened departments, satellites, and settings.

## Decision

### Hierarchy (commercial)

```
STANDALONE Organization
├── Satellites (OrganizationSatelliteEntitlement + SatelliteEndpoint)
│     └── CommercialOutlet (CP registry)
└── Department Organizations (operatingMode=DEPARTMENT, parentOrgId)
      └── their satellites → outlets
```

- **Department** is a child `Organization`, not a folder and not a satellite.
- **Satellite** is a product bind under an org.
- **Outlet** is a billable/ops point under a satellite ([commercial-outlet-registry.md](./commercial-outlet-registry.md)).
- **Workforce OrgUnit** is a different tree — never render it inside Structure.

### Suspend / kill

| Level | Mechanism | Effect |
|-------|-----------|--------|
| Org / Dept | `OrganizationSubscription.isBlocked` | Freeze access; children inherit **effective** block |
| Satellite | `OrganizationSatelliteEntitlement.suspendedAt` + prefer `SatelliteEndpoint.enabled=false` | Deny Open/SSO; exclude from billable sat lines; push runtime-config |
| Outlet | `CommercialOutlet.status=SUSPENDED` | Deny till for code; exclude from POS capacity gauge |

```
effective(outlet) = org.blocked OR dept.blocked OR sat.suspended OR outlet.suspended
```

UI shows own toggle plus read-only "off because parent" when inherited.

Issued invoices are not rewritten. Forward billing skips suspended/blocked scopes. Mid-month suspend: stop new accrual; calendar month rules for SKUs follow [sku-grace-trial-7d.md](./sku-grace-trial-7d.md) and existing post-paid law.

## Consequences

- Structure is the ops home for kill; Systems tiles only launch.
- Detach DEPARTMENT to STANDALONE remains [org-operating-mode.md](./org-operating-mode.md); suspend is not detach.
