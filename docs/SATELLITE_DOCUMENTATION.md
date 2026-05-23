# Satellite documentation standard

Every ERA industry satellite follows this layout. **DELIVERY** is the source of truth for checkboxes; **PRD §3** summarizes module status for PM.

## Umbrella (shared)

| Document | Path |
|----------|------|
| Global UI/UX | [`DESIGN.md`](../DESIGN.md) |
| Run all services | [`SETUP_AND_RUN.md`](./SETUP_AND_RUN.md) |
| SSO & event bus | [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md) |
| Smoke checklist | [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md) |
| This standard | `SATELLITE_DOCUMENTATION.md` |

## Per-satellite layout

```
era-{name}/
  PRD.md
  TZ.md
  README.md
  doc/
    DELIVERY-{NAME}.md
    UAT-SMOKE.md
    DOCUMENTATION-INDEX.md
    clone-spec/
      00-vision-and-boundaries.md
      01-finance-boundary.md
```

## PRD.md required sections

1. **Vision** — scope and explicit out-of-scope
2. **Personas & roles** — link to RBAC in TZ / clone-spec
3. **Modules** — table with status: `PLANNED | IN_PROGRESS | MVP | DONE | DEFERRED`
4. **User stories** — IDs and acceptance criteria
5. **Integrations** — orchestrator events, Finance handoff
6. **Release phases**
7. **Changelog**

## Finance boundary (all satellites)

- **In Finance:** GL, NAS, full inventory valuation, counterparty MDM (CRM), invoice issuance, WhatsApp **invoice delivery**
- **In satellite:** operational UX, shifts, domain documents, typed outbound events with `correlationId`
- **Never:** duplicate GL posting or master counterparty registry in satellite DB

## Event contract

Publish via `POST {ORCHESTRATOR}/api/v1/satellite-events` with `@era/contracts` Zod types. See [`packages/era-contracts`](../packages/era-contracts).

## Satellite index

| App | PRD | Port | Host |
|-----|-----|------|------|
| era-hotel-pms | [PRD](../era-hotel-pms/doc/clone-spec/README.md) | 3000 | hotel.era.az |
| era-fb-pos | [PRD](../era-fb-pos/PRD.md) | 3200 | pos.era.az |
| era-retail-pos | [PRD](../era-retail-pos/PRD.md) | 3300 | retail.era.az |
| era-logistics | [PRD](../era-logistics/PRD.md) | 3301 | logistics.era.az |
| era-construction | [PRD](../era-construction/PRD.md) | 3302 | construction.era.az |
| era-crm-field | [PRD](../era-crm-field/PRD.md) | 3303 | crm.era.az |
| era-auto-sto | [PRD](../era-auto-sto/PRD.md) | 3304 | auto.era.az |
| era-wholesale | [PRD](../era-wholesale/PRD.md) | 3305 | wholesale.era.az |
| era-clinic | [PRD](../era-clinic/PRD.md) | 3306 | clinic.era.az |
