# ADR: Nafta program quota knots (Wave B)

**Status:** Accepted  
**Date:** 2026-08-30

## Decision

1. Quota SoT = `ProgramTemplateQuotaKnot` (nights × procedure × qty), not flat `ProgramTemplateProcedure.quotaTotal`.
2. `quotaFor` clamps to `maxNights`, refuses below `minNights`, interpolates between adjacent PDF columns (`Math.round`).
3. Stay nights come from hotel check-in/out; `endsOn` follows checkout.
4. Package/night change → `recalcProgramQuotas`; **never** cancel `SCHEDULED`/`CHECKED_IN`/`COMPLETED`; drop only orphan `PROPOSED`.
5. Charging: in-quota `amountNet=0` when a balance line exists (ignore global `packageIncluded`); over-quota = list price; walk-in without instance always paid.

## Related

- CLI-51, AC-CLI-SAN-QUOTA (out of SAN rollup)
- Wave A dual-run SKU ADR
