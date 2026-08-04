## Summary

<!-- Why this change exists (1–3 bullets). -->

## Security impact

- [ ] **AuthZ / roles** (SSO, guards, admin vs ops)
- [ ] **Tenancy / org binding** (`organizationId`, satellite deploy org)
- [ ] **Service / bridge tokens** (internal routes, event publish)
- [ ] **Money / ledger** (post, pay, cash, payroll)
- [ ] **None of the above** (docs, UI copy, non-sensitive)

If any of the first four are checked: cite finding IDs from [`docs/SECURITY_HYGIENE_PROGRAM.md`](docs/SECURITY_HYGIENE_PROGRAM.md) Appendix A when applicable, and add a negative test or audit rule when closing a P0/P1 class.

## Test plan

- [ ] …
- [ ] `npm run check:acceptance` (if docs/acceptance touched)
- [ ] `npm run audit:integration:strict` (if MDM/hub/workforce contracts touched)

## Related

<!-- PR / ADR / finding IDs -->
