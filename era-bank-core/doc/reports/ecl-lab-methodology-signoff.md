# ECL lab methodology sign-off (not certified)

**Status:** Lab methodology note only. Does **not** claim Pilot-ready, ga, or certified IFRS 9.

## Scope

- Stage flat-rate ECL (`STAGE_FLAT`: 1% / 10% / 50%) remains default for smoke.
- Optional `PD_LGD` path uses seeded `EclParameterSet` (`lab-v1`): PD by stage × LGD (collateral haircut).
- Provision postings require maker-checker (`PENDING_PROVISION_APPROVAL` → `provision-approve`).

## Required before any “certified” / Pilot risk claim

1. External methodology document approved by risk owner.
2. Lab UAT sign-off artifact under `reports/*-signoff.md` with officer evidence.
3. Partner/auditor checklist when available.
4. Acceptance matrices remain 🟡 until those artifacts exist.

Code alone never flips `pilot_ready` or edition `ga`.
