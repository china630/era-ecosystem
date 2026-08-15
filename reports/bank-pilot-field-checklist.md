# Bank Pilot field checklist (YC-E7) — template

**Status:** ⏸ blocked on partner sandbox + customer field RT  
**Edition gate:** `docs/editions/bank.yaml` `pilot_ready` may flip only when this checklist is signed.

## Prerequisites

- [ ] YC-E1 staging rail ACK artifact linked
- [ ] YC-E2 live cards gateway staging evidence
- [ ] YC-E3 ASAN/SİMA live (or documented waiver)
- [ ] YC-E4 AKB + ECL methodology partner sign-off
- [ ] YC-E5 FMN/CBAR live submit (sanctions waiver if BLOCKED)
- [ ] YC-E6 pentest + HA EOD report (no critical open)

## Field RT

- [ ] Operator UAT-SMOKE full envelope on staging with live modes
- [ ] Customer DBO journey (OTP/ASAN, pay, SO, loan apply, 3DS)
- [ ] Partner / bank sign-off letter dated
- [ ] Incident / rollback drill recorded

## Closeout

- [ ] Update `docs/editions/bank.yaml` → `pilot_ready: true`
- [ ] Product-Readiness Pilot field `[x]`
- [ ] CERTIFICATION-TRACK YC-E7 `[x]`
- [ ] `npm run check:acceptance:strict` PASS

**Do not** check these boxes without real staging/field evidence.
