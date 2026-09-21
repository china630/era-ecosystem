# Evrostar Wave 0 — group contour + cadre mirror runbook

**Pilot:** Evrostar / Evrostar Group (two VÖEN, one Holding).  
**Canon:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) §6 wave 0.  
**Out of scope:** payroll calc, labor roster, federated HR UI, order templates, MANAGEMENT book.

Day-1 UX for wave 0 is the **organization switcher** in the orchestrator header. Federated holding HR UI (`CP-WF-GROUP-01`) ships in **wave 3** as API + UI (not SHIPPED until UAT-SMOKE) — see [evrostar-wave-3.md](./evrostar-wave-3.md).

---

## Preconditions

| Piece | Requirement |
|-------|-------------|
| Product | Two **STANDALONE** orgs (never make Group a `DEPARTMENT` of Evrostar — that merges WorkforceScope) |
| Entitlements (each org) | `platform_workforce` + `platform_workforce_pro` (Premium), `nas`, `hr_full` |
| Quotas | `maxEmployees` ≥ 250 per org (cleaners without satellite seats count as headcount, not seat) |
| Finance worker | Consumes `era-satellite-events` with TERMINATED + HIRED handlers |

---

## Provisioning checklist

1. **Register orgs** as OWNER: **Evrostar** (VÖEN A) and **Evrostar Group** (VÖEN B) via Control Plane register-organization (`STANDALONE`).
2. **Entitle each org** (SuperAdmin / billing): `platform_workforce`, `platform_workforce_pro`, `nas`, `hr_full`. Inventory optional for wave 0 exit.
3. Set **`maxEmployees` ≥ 250** on each subscription.
4. Create Holding **«Evrostar Group»** → **attach both** orgs. Holding VIEWER ≠ HR: grant org role `HR_MANAGER` (or OWNER) on **both** memberships so the header switcher can open each workforce tree.
5. **Finance org ensure** happens automatically on first workforce event (`WorkforceOrgEnsureService`), or optionally SSO into Finance once per org before bulk import.
6. **Bootstrap Workforce** on A and on B: `POST /platform/v1/workforce/scope/bootstrap` (each anchor → its own scope). Without bootstrap, hire returns 404.
7. **Import order per org** (fail-visible if reversed — Finance throws `WorkforceMirrorMissingError` and BullMQ retries):
   1. Org structure (`WORKFORCE_ORG_UNIT_UPSERTED`)
   2. Positions (`WORKFORCE_POSITION_UPSERTED`)
   3. Roster / hire (`WORKFORCE_EMPLOYMENT_HIRED`)
8. Compatriot (same FIN / MDM person) in the second firm: second hire in the **other** org’s scope — same `globalPersonId`, new `WorkforceEmployment`, new Finance `Employee`. **P2:** after hire, dual-ACTIVE VÖEN banner (does not block hire). Group-card link when a Holding exists; otherwise copy tells the operator to use the org switcher. Banner still works without Holding via `GET …/persons/:id/employments` (memberships union).

---

## UAT script

| # | Step | Expected |
|---|------|----------|
| 1 | Switcher → org A → hire person P | CP employment ACTIVE in scope A; Finance `Employee` in org A; CP `financeEmployeeId` set |
| 2 | Switcher → org B → hire same person P | Second employment ACTIVE in scope B; second Finance `Employee` in org B |
| 3 | Terminate employment in org A only | Finance Employee A → `TERMINATED` + `contractEndDate`; Employee B stays `ACTIVE` |
| 4 | Absence `VACATION` while switched to org B | Absence / Finance mirror only for org B employment (resolve by `financeEmployeeId` or `cpEmploymentId`) |
| 5 | Open Finance HR for each org | Contract salary can be set on Employee (hire mirror uses `salary: 0`) |

### Negative

| Case | Expected |
|------|----------|
| Group org created as `DEPARTMENT` of Evrostar | Single WorkforceScope (parent anchor) — **forbidden** for this pilot |
| `hr_full` only on A | Hire in B → Finance skip `no_hr_full` (no Employee B) |
| Second hire of same person in **same** scope with seat | `WORKFORCE_SEAT_TAKEN` (cleaning hires without `satelliteKeys` use headcount) |
| Hire before position mirror | Finance log + retry (`position_mirror_missing`), not silent skip |
| Absence before hire mirror lands | Finance retry (`employee_mirror_missing`) until Employee exists — not buried idempotent skip |
| Finance org UUID ≠ CP org UUID for same VÖEN | Ensure throws UUID mismatch (fail-visible); do not import until aligned |

---

## Wave 0 exit criteria

- [ ] Two STANDALONE + Holding in CP; two WorkforceScopes
- [ ] HR/owner sees both orgs via switcher
- [ ] One MDM person → two ACTIVE employments → two Finance Employees
- [ ] Terminate A does not terminate B
- [ ] Absence scoped to current org context
- [ ] No payroll run, no object/shift roster, no order templates, no MGMT book

---

## Related

- Integration contracts: [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) (HIRED / TERMINATED consumers)
- Coverage: `CP-WF-GROUP-01` = API (wave 3 federated UI; not SHIPPED until UAT-SMOKE)
