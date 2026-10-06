# ADR: Satellite role catalog for the workforce matrix

**Status:** Accepted (2026-10)

**Related:** [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md)

## Decision

Each satellite owns its role **code** and **name**. The control plane keeps a copy in `SatelliteRoleCatalog` (`organizationId`, `satelliteKey`, `code`, `name`, `active`). Permission JSON stays on the satellite.

Satellites push one row on create, rename, and delete (`active: false`). That one row does not hide the other codes. A debounced snapshot when an admin opens the role list replaces the set: codes missing from the list become inactive and drop out of the matrix. The control plane pulls `GET /api/internal/v1/workforce/roles` only when that org has no rows yet for the satellite. A failed push does not roll back the satellite save. An empty snapshot does not wipe the catalog.

The workforce matrix (clinic, hotel, F&B, retail) lists **active** catalog rows. `/workspace/workforce/security/roles` lists every catalog row, including satellites that are not matrix columns, and the active employments already bound to that code. A manual grant is a mark on that person, not a second roster. An empty catalog means no access for that cell. There is no silent `RECEPTION` / `STAFF` / `CASHIER` default. A saved code that is no longer active stays visible as “choose again” and is not rewritten. Hire and manual grant accept only an active catalog code (`SATELLITE_ROLE_UNKNOWN` / `SATELLITE_ROLE_UNSET`).

Provision looks up the satellite role by the exact code. One-time SQL remaps the old enum aliases that were 1:1 (`HOUSEKEEPING` → `Housekeeper`, and the same for clinic, F&B, and retail). `STAFF` is left so the matrix can ask for a new choice.

The same push and pull exist on CRM, wholesale, construction, logistics, auto service, and bank (`OpsRole`, key `industry_banking`) so a later matrix column does not need a new enum. Those products are not matrix columns until they provision staff logins.
