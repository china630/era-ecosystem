# Nafta package pilot punch (Waves A–E polish)

**Date:** 2026-08-30  
**Honesty:** Engineering complete for P0 polish paths; **not SHIPPED** / **not Pilot-ready** / **not ga** until FO signs this punch in the field.

## Locked defaults

| Topic | Decision |
|-------|----------|
| Leisure | Hotel skips sanatorium check-in lifecycle for `Walkin leisure` (`stayKind: leisure`) |
| Bonus % | Tenant defaults **0**; FO sets `%` in clinic Admin → Settings before pilot. Do **not** invent % in seed. |

## Hotel UAT §38–41

| Step | Result | Notes |
|------|--------|-------|
| §38 ERA-PKG Extra → stamp | ☐ pass / ☐ fail | |
| §38 Agency Premium walk-in → PKG-PREMIUM | ☐ | |
| §38 Walkin leisure → no lifecycle fan-out | ☐ | |
| §38 Həmkarlar → STANDART; Extra overrides | ☐ | |
| §38 Agency table CRUD `/settings/agency-medical-sku` | ☐ | |
| §38 FO Guests tab per-pax SKU + compose refresh | ☐ | |
| §39 Date amend → stay-product + clinic quota recalc | ☐ | SCHEDULED kept |
| §39 Mid-stay Premium→Standart companion → folio + quotas | ☐ | |
| §40 Compose 289 on folio (193+96) | ☐ | |
| §40 Night audit scaled to compose; main SKU lines | ☐ | |
| §41 Two lifecycle events / two clinic rows | ☐ | |
| §41 Share 707/707S regression | ☐ | |

## Clinic CLI-50…54

| Step | Result | Notes |
|------|--------|-------|
| CLI-50 Select 4 SKUs on unresolved | ☐ | |
| CLI-51 Knots / recalc on amend | ☐ | |
| CLI-52 Day-1 confirm 2–3 exams; soft-warn >3 | ☐ | |
| CLI-53 Bonus 0 on package-only; paid extra → bucket | ☐ | |
| CLI-54 Two sanatorium rows same room | ☐ | |

## Bonus % checklist (#41)

| Item | Value |
|------|-------|
| `doctorBonusPercentInHouse` (settings) | **0** until FO number |
| `doctorBonusPercentWalkIn` (settings) | **0** until FO number |
| FO supplied numbers (date / who) | _pending_ |
| PATCH settings verified | ☐ |

## Droplet / contracts

- Script: `scripts/_tmp_utf8/droplet-nafta-pilot-migrations.sh`
- Clinic: knots, `bonus_eligible`, doctor bonus %, OPEN episode unique
- Hotel: medical package columns, `AgencyMedicalSkuRule`
- `@era/contracts` guest lifecycle includes optional `paxKey` — rebuild package after pull

## Sign-off

| Role | Name | Date | Sign |
|------|------|------|------|
| FO lead | | | ☐ |
| Clinic lead | | | ☐ |
| Engineering | | 2026-08-30 | code paths ready |

When signed: optionally bump COVERAGE HOT-PKG-02 / CLI-50… only with UI evidence — still no false SHIPPED without UAT artifact.
