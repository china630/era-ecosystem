# ADR: Nafta program quota knots (Wave B)

**Status:** Accepted  
**Date:** 2026-08-30

## Decision

1. Quota SoT = `ProgramTemplateQuotaKnot` (nights × procedure × qty), not flat `ProgramTemplateProcedure.quotaTotal`.
2. `quotaFor` clamps to `maxNights`, refuses below `minNights`, interpolates between adjacent PDF columns (`Math.round`).
3. Stay nights come from hotel check-in/out; `endsOn` follows checkout.
4. Package/night change → `recalcProgramQuotas`; **never** cancel `CHECKED_IN`/`COMPLETED`; drop orphan `PROPOSED`. **Amended 2026-09-04** ([clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md)): when stay **shortens**, also cancel **future non-consumed** `SCHEDULED` past the new end and return unused quota (1 code/category/day sync). Do not silently delete COMPLETED; over-consumed vs new total → pay path.
5. Charging: in-quota `amountNet=0` when a balance line exists (ignore global `packageIncluded`); over-quota = list price; walk-in without instance always paid.

## Related

- CLI-51, AC-CLI-SAN-QUOTA (out of SAN rollup)
- Wave A dual-run SKU ADR
- CLI-57 package assign modal (PLANNED)
